import type { Action } from 'redux'
import type { ThunkAction, ThunkDispatch } from './types'

const REJECT_WITH_VALUE_SYMBOL: unique symbol = Symbol.for(
  'redux-thunk/rejectWithValue',
)

export interface PendingAction<ThunkArg> extends Action<string> {
  type: string
  meta: {
    arg: ThunkArg
    requestId: string
    requestStatus: 'pending'
  }
}

export interface FulfilledAction<ThunkArg, Returned> extends Action<string> {
  type: string
  payload: Returned
  meta: {
    arg: ThunkArg
    requestId: string
    requestStatus: 'fulfilled'
  }
}

export interface RejectedAction<ThunkArg, RejectedValue>
  extends Action<string> {
  type: string
  payload?: RejectedValue
  error: {
    name: string
    message: string
    stack?: string
    code?: string
  }
  meta: {
    arg: ThunkArg
    requestId: string
    requestStatus: 'rejected'
    aborted: boolean
    condition: boolean
    rejectedWithValue: boolean
  }
}

export type AsyncThunkAction<
  Returned,
  ThunkArg,
  State = any,
  ExtraThunkArg = undefined,
  BasicAction extends Action = any,
  RejectedValue = unknown,
> = ThunkAction<
  Promise<
    | FulfilledAction<ThunkArg, Returned>
    | RejectedAction<ThunkArg, RejectedValue>
  >,
  State,
  ExtraThunkArg,
  BasicAction
>

interface RejectWithValue<RejectedValue> {
  (value: RejectedValue, error?: Error): {
    [REJECT_WITH_VALUE_SYMBOL]: true
    value: RejectedValue
    error: Error
  }
}

interface RejectWithValueResult<RejectedValue> {
  [REJECT_WITH_VALUE_SYMBOL]: true
  value: RejectedValue
  error: Error
}

export interface AsyncThunkPayloadCreator<
  Returned,
  ThunkArg,
  State = any,
  ExtraThunkArg = undefined,
  RejectedValue = unknown,
> {
  (
    arg: ThunkArg,
    thunkApi: {
      dispatch: ThunkDispatch<State, ExtraThunkArg, any>
      getState: () => State
      extra: ExtraThunkArg
      requestId: string
      signal: AbortSignal
      rejectWithValue: RejectWithValue<RejectedValue>
    },
  ): Promise<Returned>
}

export interface CreateAsyncThunkOptions<
  ThunkArg,
  State = any,
  ExtraThunkArg = undefined,
> {
  condition?(
    arg: ThunkArg,
    thunkApi: {
      getState: () => State
      extra: ExtraThunkArg
    },
  ): boolean | undefined
  dispatchConditionRejection?: boolean
  idGenerator?(arg: ThunkArg): string
}

export interface AsyncThunk<
  Returned,
  ThunkArg,
  State = any,
  ExtraThunkArg = undefined,
  BasicAction extends Action = any,
  RejectedValue = unknown,
> {
  (arg: ThunkArg): AsyncThunkAction<
    Returned,
    ThunkArg,
    State,
    ExtraThunkArg,
    BasicAction,
    RejectedValue
  >

  pending: (requestId: string, arg: ThunkArg) => PendingAction<ThunkArg>
  fulfilled: (
    payload: Returned,
    requestId: string,
    arg: ThunkArg,
  ) => FulfilledAction<ThunkArg, Returned>
  rejected: (
    error: Error | { message: string; name?: string; code?: string },
    requestId: string,
    arg: ThunkArg,
    payload?: RejectedValue,
  ) => RejectedAction<ThunkArg, RejectedValue>
  typePrefix: string
}

let nextId = 0
function defaultRequestId() {
  return `${++nextId}`
}

function serializeError(error: any): {
  name: string
  message: string
  stack?: string
  code?: string
} {
  return {
    name: error?.name ?? 'Error',
    message: error?.message ?? 'Unknown error',
    stack: error?.stack,
    code: error?.code,
  }
}

function isRejectWithValueResult(obj: any): obj is RejectWithValueResult<any> {
  return (
    obj &&
    typeof obj === 'object' &&
    obj[REJECT_WITH_VALUE_SYMBOL] === true
  )
}

export function createAsyncThunk<
  Returned,
  ThunkArg = void,
  State = any,
  ExtraThunkArg = undefined,
  BasicAction extends Action = any,
  RejectedValue = unknown,
>(
  typePrefix: string,
  payloadCreator: AsyncThunkPayloadCreator<
    Returned,
    ThunkArg,
    State,
    ExtraThunkArg,
    RejectedValue
  >,
  options?: CreateAsyncThunkOptions<ThunkArg, State, ExtraThunkArg>,
): AsyncThunk<
  Returned,
  ThunkArg,
  State,
  ExtraThunkArg,
  BasicAction,
  RejectedValue
> {
  const pendingType = `${typePrefix}/pending`
  const fulfilledType = `${typePrefix}/fulfilled`
  const rejectedType = `${typePrefix}/rejected`

  const pending = (
    requestId: string,
    arg: ThunkArg,
  ): PendingAction<ThunkArg> => ({
    type: pendingType,
    meta: {
      arg,
      requestId,
      requestStatus: 'pending',
    },
  })

  const fulfilled = (
    payload: Returned,
    requestId: string,
    arg: ThunkArg,
  ): FulfilledAction<ThunkArg, Returned> => ({
    type: fulfilledType,
    payload,
    meta: {
      arg,
      requestId,
      requestStatus: 'fulfilled',
    },
  })

  const rejected = (
    error: Error | { message: string; name?: string; code?: string },
    requestId: string,
    arg: ThunkArg,
    payload?: RejectedValue,
    condition: boolean = false,
  ): RejectedAction<ThunkArg, RejectedValue> => ({
    type: rejectedType,
    payload,
    error: serializeError(error),
    meta: {
      arg,
      requestId,
      requestStatus: 'rejected',
      aborted: false,
      condition,
      rejectedWithValue: typeof payload !== 'undefined',
    },
  })

  function actionCreator(
    arg: ThunkArg,
  ): AsyncThunkAction<
    Returned,
    ThunkArg,
    State,
    ExtraThunkArg,
    BasicAction,
    RejectedValue
  > {
    return (dispatch, getState, extra) => {
      const idGenerator = options?.idGenerator ?? defaultRequestId
      const requestId = idGenerator(arg)

      const conditionResult = options?.condition?.(arg, { getState, extra })
      if (conditionResult === false) {
        if (options?.dispatchConditionRejection) {
          dispatch(
            rejected(
              new Error('Aborted due to condition callback returning false.'),
              requestId,
              arg,
              undefined,
              true,
            ) as unknown as BasicAction,
          )
        }
        return Promise.resolve(
          rejected(
            new Error('Aborted due to condition callback returning false.'),
            requestId,
            arg,
            undefined,
            true,
          ),
        )
      }

      const abortController = new AbortController()

      dispatch(pending(requestId, arg) as unknown as BasicAction)

      const rejectWithValue: RejectWithValue<RejectedValue> = (
        value,
        error,
      ) => {
        const result: RejectWithValueResult<RejectedValue> = {
          [REJECT_WITH_VALUE_SYMBOL]: true,
          value,
          error: error ?? new Error('Rejected with value'),
        }
        return result
      }

      return Promise.resolve()
        .then(() =>
          payloadCreator(arg, {
            dispatch,
            getState,
            extra,
            requestId,
            signal: abortController.signal,
            rejectWithValue,
          }),
        )
        .then(
          result => {
            if (isRejectWithValueResult(result)) {
              const action = rejected(
                result.error,
                requestId,
                arg,
                result.value,
              )
              dispatch(action as unknown as BasicAction)
              return action
            }
            const action = fulfilled(result, requestId, arg)
            dispatch(action as unknown as BasicAction)
            return action
          },
          err => {
            if (isRejectWithValueResult(err)) {
              const action = rejected(
                err.error,
                requestId,
                arg,
                err.value,
              )
              dispatch(action as unknown as BasicAction)
              return action
            }
            const action = rejected(err as Error, requestId, arg)
            dispatch(action as unknown as BasicAction)
            return action
          },
        )
    }
  }

  actionCreator.pending = pending
  actionCreator.fulfilled = fulfilled
  actionCreator.rejected = rejected
  actionCreator.typePrefix = typePrefix

  return actionCreator as AsyncThunk<
    Returned,
    ThunkArg,
    State,
    ExtraThunkArg,
    BasicAction,
    RejectedValue
  >
}
