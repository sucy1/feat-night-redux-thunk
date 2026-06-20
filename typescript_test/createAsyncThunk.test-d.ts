import { applyMiddleware, createStore } from 'redux'
import type {
  AsyncThunk,
  AsyncThunkAction,
  AsyncThunkPayloadCreator,
  CreateAsyncThunkOptions,
  FulfilledAction,
  PendingAction,
  RejectedAction,
} from 'redux-thunk'
import { createAsyncThunk, thunk } from 'redux-thunk'

describe('createAsyncThunk type tests', () => {
  type State = { data: string | null; loading: boolean }
  type Actions =
    | { type: 'FETCH_PENDING' }
    | { type: 'FETCH_FULFILLED'; payload: string }
    | { type: 'FETCH_REJECTED'; error: string }

  const initialState: State = { data: null, loading: false }

  function reducer(state: State = initialState): State {
    return state
  }

  const store = createStore(reducer, applyMiddleware(thunk))

  test('createAsyncThunk infers return type', () => {
    const fetchUser = createAsyncThunk<string, string>(
      'users/fetch',
      async (id: string) => `user-${id}`,
    )

    expectTypeOf(fetchUser).toBeCallableWith('abc')
    expectTypeOf(fetchUser.typePrefix).toBeString()
    expectTypeOf(fetchUser.pending).toBeCallableWith('req-1', 'arg')
    expectTypeOf(fetchUser.fulfilled).toBeCallableWith('payload', 'req-2', 'arg')
    expectTypeOf(fetchUser.rejected).toBeCallableWith(
      new Error('fail'),
      'req-3',
      'arg',
    )
  })

  test('pending action has correct meta', () => {
    const fetchUser = createAsyncThunk<string, number>(
      'users/fetch',
      async (id: number) => `user-${id}`,
    )

    const action = fetchUser.pending('req-1', 42)
    expectTypeOf(action.type).toBeString()
    expectTypeOf(action.meta.requestStatus).toEqualTypeOf<'pending'>()
    expectTypeOf(action.meta.arg).toBeNumber()
    expectTypeOf(action.meta.requestId).toBeString()
  })

  test('fulfilled action has correct payload and meta', () => {
    const fetchUser = createAsyncThunk<string, number>(
      'users/fetch',
      async (id: number) => `user-${id}`,
    )

    const action = fetchUser.fulfilled('result', 'req-1', 42)
    expectTypeOf(action.payload).toBeString()
    expectTypeOf(action.meta.requestStatus).toEqualTypeOf<'fulfilled'>()
    expectTypeOf(action.meta.arg).toBeNumber()
  })

  test('rejected action has correct error and meta', () => {
    const fetchUser = createAsyncThunk<string, number>(
      'users/fetch',
      async (id: number) => `user-${id}`,
    )

    const action = fetchUser.rejected(new Error('fail'), 'req-1', 42)
    expectTypeOf(action.error.message).toBeString()
    expectTypeOf(action.meta.requestStatus).toEqualTypeOf<'rejected'>()
    expectTypeOf(action.meta.arg).toBeNumber()
    expectTypeOf(action.meta.condition).toBeBoolean()
    expectTypeOf(action.meta.aborted).toBeBoolean()
    expectTypeOf(action.meta.rejectedWithValue).toBeBoolean()
  })

  test('rejected action with custom rejected value type', () => {
    const fetchUser = createAsyncThunk<string, void, any, any, any, { code: number }>(
      'users/fetch',
      async () => 'data',
    )

    const action = fetchUser.rejected(
      new Error('fail'),
      'req-1',
      undefined,
      { code: 404 },
    )
    expectTypeOf(action.payload).toEqualTypeOf<{ code: number } | undefined>()
  })

  test('thunkApi provides correct types', () => {
    const fetchUser = createAsyncThunk<string, string, State, { api: string }>(
      'users/fetch',
      async (id, thunkApi) => {
        expectTypeOf(thunkApi.dispatch).toBeFunction()
        expectTypeOf(thunkApi.getState).toBeFunction()
        expectTypeOf(thunkApi.extra).toEqualTypeOf<{ api: string }>()
        expectTypeOf(thunkApi.requestId).toBeString()
        expectTypeOf(thunkApi.signal).toEqualTypeOf<AbortSignal>()
        expectTypeOf(thunkApi.rejectWithValue).toBeFunction()
        return `user-${id}`
      },
    )
  })

  test('rejectWithValue accepts custom type', () => {
    const fetchUser = createAsyncThunk<
      string,
      void,
      State,
      undefined,
      any,
      { code: number; message: string }
    >('users/fetch', async (_, thunkApi) => {
      const result = thunkApi.rejectWithValue({
        code: 404,
        message: 'Not found',
      })
      expectTypeOf(result.value).toEqualTypeOf<{ code: number; message: string }>()
      expectTypeOf(result.error).toEqualTypeOf<Error>()
      throw result
    })
  })

  test('CreateAsyncThunkOptions type', () => {
    const options: CreateAsyncThunkOptions<string, State, undefined> = {
      condition: (arg, { getState, extra }) => {
        expectTypeOf(arg).toBeString()
        expectTypeOf(getState).toBeFunction()
        expectTypeOf(extra).toEqualTypeOf<undefined>()
        return true
      },
      dispatchConditionRejection: true,
      idGenerator: (arg) => `id-${arg}`,
    }

    const fetchUser = createAsyncThunk<string, string, State, undefined>(
      'users/fetch',
      async (id) => `user-${id}`,
      options,
    )

    expectTypeOf(fetchUser).toBeFunction()
  })

  test('void arg type', () => {
    const fetchData = createAsyncThunk<string>('data/fetch', async () => 'data')
    expectTypeOf(fetchData).toBeCallableWith()
  })

  test('PendingAction type', () => {
    type MyPendingAction = PendingAction<string>
    const action: MyPendingAction = {
      type: 'test/pending',
      meta: {
        arg: 'test-arg',
        requestId: '1',
        requestStatus: 'pending',
      },
    }
    expectTypeOf(action.meta.arg).toBeString()
    expectTypeOf(action.meta.requestStatus).toEqualTypeOf<'pending'>()
  })

  test('FulfilledAction type', () => {
    type MyFulfilledAction = FulfilledAction<string, number>
    const action: MyFulfilledAction = {
      type: 'test/fulfilled',
      payload: 42,
      meta: {
        arg: 'test-arg',
        requestId: '1',
        requestStatus: 'fulfilled',
      },
    }
    expectTypeOf(action.payload).toBeNumber()
    expectTypeOf(action.meta.requestStatus).toEqualTypeOf<'fulfilled'>()
  })

  test('RejectedAction type', () => {
    type MyRejectedAction = RejectedAction<string, { code: number }>
    const action: MyRejectedAction = {
      type: 'test/rejected',
      payload: { code: 500 },
      error: {
        name: 'Error',
        message: 'fail',
      },
      meta: {
        arg: 'test-arg',
        requestId: '1',
        requestStatus: 'rejected',
        aborted: false,
        condition: false,
        rejectedWithValue: true,
      },
    }
    expectTypeOf(action.payload).toEqualTypeOf<{ code: number } | undefined>()
    expectTypeOf(action.meta.requestStatus).toEqualTypeOf<'rejected'>()
    expectTypeOf(action.meta.rejectedWithValue).toBeBoolean()
  })

  test('AsyncThunk type', () => {
    type MyAsyncThunk = AsyncThunk<string, number, State, undefined, any, string>
    const thunk: MyAsyncThunk = createAsyncThunk<
      string,
      number,
      State,
      undefined,
      any,
      string
    >('test/fetch', async (id) => `result-${id}`)

    expectTypeOf(thunk).toBeCallableWith(42)
    expectTypeOf(thunk.typePrefix).toBeString()
    expectTypeOf(thunk.pending).toBeFunction()
    expectTypeOf(thunk.fulfilled).toBeFunction()
    expectTypeOf(thunk.rejected).toBeFunction()
  })

  test('AsyncThunkPayloadCreator type', () => {
    type MyPayloadCreator = AsyncThunkPayloadCreator<
      string,
      number,
      State,
      undefined,
      string
    >
    const creator: MyPayloadCreator = async (arg, thunkApi) => {
      expectTypeOf(arg).toBeNumber()
      expectTypeOf(thunkApi.dispatch).toBeFunction()
      expectTypeOf(thunkApi.getState).toBeFunction()
      expectTypeOf(thunkApi.extra).toEqualTypeOf<undefined>()
      expectTypeOf(thunkApi.requestId).toBeString()
      expectTypeOf(thunkApi.signal).toEqualTypeOf<AbortSignal>()
      expectTypeOf(thunkApi.rejectWithValue).toBeFunction()
      return `result-${arg}`
    }
  })

  test('AsyncThunkAction type', () => {
    type MyAsyncThunkAction = AsyncThunkAction<
      string,
      number,
      State,
      undefined,
      any,
      string
    >

    const thunk = createAsyncThunk<
      string,
      number,
      State,
      undefined,
      any,
      string
    >('test/fetch', async (id) => `result-${id}`)

    const _action: MyAsyncThunkAction = thunk(42)

    expectTypeOf(thunk).toBeCallableWith(42)
    expectTypeOf(thunk.typePrefix).toBeString()
  })
})
