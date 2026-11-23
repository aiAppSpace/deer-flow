import { computed, onScopeDispose } from "vue";
import {
  useMutation,
  useQueryClient,
  type MutateOptions,
} from "@tanstack/vue-query";
import { captureWorkspaceQueryOwner } from "@/core/auth/workspace-queries";

type OwnedInput<T> = { input: T; isCurrent: () => boolean };
type MutationOptions<TData, TInput> = {
  mutationFn: (input: TInput, signal: AbortSignal) => Promise<TData>;
  onSuccess?: (data: TData, input: TInput, isCurrent: () => boolean) => unknown;
  onError?: (error: Error, input: TInput) => unknown;
  onSettled?: (
    data: TData | undefined,
    error: Error | null,
    input: TInput,
  ) => unknown;
};

/** Each component owner cancels its I/O and rejects late responses after disposal. */
export function useScopedGatewayRequests() {
  const client = useQueryClient();
  const controllers = new Set<AbortController>();
  let active = true;
  function assertActive(isCurrent: () => boolean, signal?: AbortSignal) {
    if (!active || !isCurrent() || signal?.aborted)
      throw new DOMException("Aborted", "AbortError");
  }
  async function run<T>(
    task: (signal: AbortSignal) => Promise<T>,
    isCurrent: () => boolean,
  ): Promise<T> {
    assertActive(isCurrent);
    const controller = new AbortController();
    controllers.add(controller);
    try {
      const result = await task(controller.signal);
      assertActive(isCurrent, controller.signal);
      return result;
    } catch (error) {
      assertActive(isCurrent, controller.signal);
      throw error;
    } finally {
      controllers.delete(controller);
    }
  }
  function mutation<TData, TInput = void>(
    options: MutationOptions<TData, TInput>,
  ) {
    const owner = useMutation<TData, Error, OwnedInput<TInput>>({
      mutationFn: ({ input, isCurrent }) =>
        run((signal) => options.mutationFn(input, signal), isCurrent),
      onSuccess: (data, { input, isCurrent }) => {
        if (isCurrent()) return options.onSuccess?.(data, input, isCurrent);
      },
      onError: (error, { input, isCurrent }) => {
        if (isCurrent()) return options.onError?.(error, input);
      },
      onSettled: (data, error, { input, isCurrent }) => {
        if (isCurrent()) return options.onSettled?.(data, error, input);
      },
    });
    function capture(input: TInput): OwnedInput<TInput> {
      const accountCurrent = captureWorkspaceQueryOwner(client);
      return { input, isCurrent: () => active && accountCurrent() };
    }
    function callbacks(
      captured: OwnedInput<TInput>,
      input?: MutateOptions<TData, Error, TInput, unknown>,
    ): MutateOptions<TData, Error, OwnedInput<TInput>, unknown> | undefined {
      if (!input) return undefined;
      return {
        onSuccess: (data, _variables, result, context) => {
          if (captured.isCurrent())
            input.onSuccess?.(data, captured.input, result, context);
        },
        onError: (error, _variables, result, context) => {
          if (captured.isCurrent())
            input.onError?.(error, captured.input, result, context);
        },
        onSettled: (data, error, _variables, result, context) => {
          if (captured.isCurrent())
            input.onSettled?.(data, error, captured.input, result, context);
        },
      };
    }
    return {
      ...owner,
      variables: computed(() => owner.variables.value?.input),
      mutate(
        input: TInput,
        options?: MutateOptions<TData, Error, TInput, unknown>,
      ) {
        const captured = capture(input);
        owner.mutate(captured, callbacks(captured, options));
      },
      async mutateAsync(
        input: TInput,
        options?: MutateOptions<TData, Error, TInput, unknown>,
      ) {
        const captured = capture(input);
        const data = await owner.mutateAsync(
          captured,
          callbacks(captured, options),
        );
        assertActive(captured.isCurrent);
        return data;
      },
    };
  }
  onScopeDispose(() => {
    active = false;
    for (const controller of controllers) controller.abort();
    controllers.clear();
  });
  return { mutation };
}
