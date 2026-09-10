/*
  【文件职责】     钉住 e2e 独占锁的判据：谁能拿到、什么算陈旧、谁有权放。
  【架构位置】     单元测试
  【依赖关系】     scripts/keep-e2e-failure-artifacts.mjs
  【边界与注意】   这道锁是**实测出来的**，不是防御性设计：wave 202 两轮
                   `make e2e-parity` 撞在一起，互相清空 / 搬走 `test-results/`，
                   表现成 3 条「新增失败」——判断它们不是回归花了 25 分钟。
                   所以下面每一条都对着一种真会发生的收场：崩溃留下的陈旧锁、
                   别的用户的进程、写了一半的锁文件、两个进程同一刻抢。

                   **不测 spawn 那一层**（那是子进程），只测「拿锁的决定」——
                   出错的方式全在这里。
*/

import { describe, expect, it } from "vitest";

import {
  acquireRunLock,
  processIsAlive,
} from "../../../scripts/keep-e2e-failure-artifacts.mjs";

const LOCK = "/results/.e2e-run.lock";

/** 一个只有一把锁的假文件系统，外加「谁还活着」这张表。 */
function fakeLockFs(
  initial: string | null = null,
  alive: Record<number, boolean> = {},
) {
  const state = { body: initial, dirs: [] as string[] };
  const io = {
    ensureDir: (path: string) => {
      state.dirs.push(path);
    },
    writeExclusive: (_path: string, body: string) => {
      if (state.body !== null) {
        throw Object.assign(new Error("EEXIST"), { code: "EEXIST" });
      }
      state.body = body;
    },
    readLock: (_path: string) => {
      if (state.body === null) {
        throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
      }
      return state.body;
    },
    removeLock: (_path: string) => {
      state.body = null;
    },
    isAlive: (pid: number) => alive[pid] === true,
  };
  return { state, io };
}

function lockBody(pid: number, startedAt = "2026-09-10T09:43:00.000Z") {
  return `${JSON.stringify({ pid, command: "playwright test", startedAt })}\n`;
}

describe("进程还在不在", () => {
  // 这一组打的是**真代码**，不是上面那个 fake：`isAlive` 在 acquireRunLock 里是可注入的，
  // 注进去测就只是在测自己写的桩。默认实现才是生产里跑的那个。
  const throwing = (code: string) => () => {
    throw Object.assign(new Error(code), { code });
  };

  it("kill(pid, 0) 不抛就是还在", () => {
    expect(processIsAlive(999, () => undefined)).toBe(true);
  });

  it("ESRCH 就是没了——陈旧锁靠这条被接管", () => {
    expect(processIsAlive(999, throwing("ESRCH"))).toBe(false);
  });

  it("EPERM 算「还在」：那是别的用户的进程，不是没了", () => {
    // 把 EPERM 当成「不存在」就等于允许跨用户并发——正是这道锁要挡的那件事。
    expect(processIsAlive(999, throwing("EPERM"))).toBe(true);
  });

  it("pid 本身不成立时不去问系统", () => {
    const asked: number[] = [];
    const spy = (pid: number) => {
      asked.push(pid);
    };
    // kill(0, 0) 在 POSIX 上是「发给整个进程组」，问它等于问自己——永远说「在」。
    expect(processIsAlive(0, spy)).toBe(false);
    expect(processIsAlive(-1, spy)).toBe(false);
    expect(processIsAlive(Number.NaN, spy)).toBe(false);
    expect(asked, "非法 pid 一个都不该问出去").toEqual([]);
  });
});

describe("e2e 独占锁：谁能拿到", () => {
  it("没人占着就拿到，并且写进去的是自己的 pid", () => {
    const { state, io } = fakeLockFs();

    const lock = acquireRunLock(LOCK, { pid: 111, command: "x", ...io });

    expect(lock.acquired).toBe(true);
    expect(JSON.parse(state.body!).pid, "锁里必须是自己").toBe(111);
    expect(state.dirs, "写之前得先保证目录在").toEqual(["/results"]);
  });

  it("持有者还活着就拿不到，并且把持有者报出来", () => {
    const { state, io } = fakeLockFs(lockBody(999), { 999: true });

    const lock = acquireRunLock(LOCK, { pid: 111, ...io });

    expect(lock.acquired).toBe(false);
    expect(lock.holder?.pid, "得说清楚是谁占着").toBe(999);
    expect(lock.holder?.startedAt).toBe("2026-09-10T09:43:00.000Z");
    expect(JSON.parse(state.body!).pid, "别人的锁不许被踩掉").toBe(999);
  });

  it("持有者已经没了（崩溃 / kill -9 留下的陈旧锁）就接管", () => {
    const { state, io } = fakeLockFs(lockBody(999), { 999: false });

    const lock = acquireRunLock(LOCK, { pid: 111, ...io });

    expect(lock.acquired).toBe(true);
    expect(JSON.parse(state.body!).pid).toBe(111);
  });

  it("锁文件写了一半（不是 JSON）就当没有持有者，直接接管", () => {
    const { state, io } = fakeLockFs('{"pid": 9', {});

    const lock = acquireRunLock(LOCK, { pid: 111, ...io });

    expect(lock.acquired, "读不出持有者时不能永远挡着路").toBe(true);
    expect(JSON.parse(state.body!).pid).toBe(111);
  });

  it("清掉陈旧锁之后又被别人抢先，就是拿不到——不许假装拿到了", () => {
    const { state, io } = fakeLockFs(lockBody(999), { 999: false });
    // 删掉陈旧锁、再次 wx 之间，另一个进程插进来把锁写走了。
    let claims = 0;
    const racing = {
      ...io,
      writeExclusive: (path: string, body: string) => {
        claims += 1;
        if (claims === 2) state.body = lockBody(222);
        io.writeExclusive(path, body);
      },
    };

    const lock = acquireRunLock(LOCK, { pid: 111, ...racing });

    expect(lock.acquired).toBe(false);
    expect(lock.holder?.pid, "报的是真正抢到的那个").toBe(222);
  });
});

/**
 * 锁的返回值是可辨识联合：**抢到才有 `release`**。这一组用例的前提都是
 * 「已经抢到」，前提不成立就是用例自己坏了——在这里断言掉，而不是在每个
 * 调用点写 `release?.()` 把它糊过去。
 */
function takeLock(...args: Parameters<typeof acquireRunLock>) {
  const lock = acquireRunLock(...args);
  if (!lock.acquired) throw new Error("用例前提不成立：这一轮没抢到锁");
  return lock;
}

describe("e2e 独占锁：谁有权放", () => {
  it("release 删的是自己的锁", () => {
    const { state, io } = fakeLockFs();
    const lock = takeLock(LOCK, { pid: 111, ...io });

    lock.release();

    expect(state.body).toBeNull();
  });

  it("锁已经被接管者改写时 release 不动它", () => {
    const { state, io } = fakeLockFs();
    const lock = takeLock(LOCK, { pid: 111, ...io });
    // 我这一轮被 kill -9，下一轮认定我死了、接管了锁；随后我的 exit 钩子才跑到。
    state.body = lockBody(222);

    lock.release();

    expect(JSON.parse(state.body!).pid, "不能把接管者的锁删掉").toBe(222);
  });
});
