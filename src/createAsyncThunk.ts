import type { Action } from 'redux'
import type { ThunkAction, ThunkDispatch } from './types'

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

export interface RejectedAction<ThunkArg, RejectedValue> extends Action<string> {
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

export interface AsyncThunkPayloadCreatorReturnValue<Returned, ThunkApi> {
  (api: ThunkApi): Promise<Returned>
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
      rejectWithValue: (value: RejectedValue, error?: Error) => {
        value: RejectedValue
        error: Error
      }
    },
  ): Promise<Returned>
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
function generateRequestId() {
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

  const pending = (requestId: string, arg: ThunkArg): PendingAction<ThunkArg> => ({
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
  ): RejectedAction<ThunkArg, RejectedValue> => ({
    type: rejectedType,
    payload,
    error: serializeError(error),
    meta: {
      arg,
      requestId,
      requestStatus: 'rejected',
      aborted: false,
      condition: false,
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
      const requestId = generateRequestId()

      dispatch(pending(requestId, arg) as unknown as BasicAction)

      const rejectWithValue = (value: RejectedValue, error?: Error) => ({
        value,
        error: error ?? new Error('Rejected with value'),
      })

      return Promise.resolve()
        .then(() =>
          payloadCreator(arg, {
            dispatch,
            getState,
            extra,
            requestId,
            rejectWithValue,
          }),
        )
        .then(
          result => {
            if (
              result &&
              typeof result === 'object' &&
              'value' in result &&
              'error' in result
            ) {
              const action = rejected(
                (result as any).error,
                requestId,
                arg,
                (result as any).value,
              )
              dispatch(action as unknown as BasicAction)
              return action
            }
            const action = fulfilled(result, requestId, arg)
            dispatch(action as unknown as BasicAction)
            return action
          },
          err => {
            if (
              err &&
              typeof err === 'object' &&
              'value' in err &&
              'error' in err
            ) {
              const action = rejected(
                (err as any).error,
                requestId,
                arg,
                (err as any).value,
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
