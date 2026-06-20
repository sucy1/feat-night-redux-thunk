import { applyMiddleware, createStore } from 'redux'
import { thunk, createAsyncThunk, withExtraArgument } from 'redux-thunk'

describe('createAsyncThunk', () => {
  interface TestState {
    data: string | null
    loading: boolean
    error: string | null
  }

  const initialState: TestState = {
    data: null,
    loading: false,
    error: null,
  }

  function reducer(
    state: TestState = initialState,
    action: any,
  ): TestState {
    switch (action.type) {
      case 'test/fetchData/pending':
        return { ...state, loading: true, error: null }
      case 'test/fetchData/fulfilled':
        return { ...state, loading: false, data: action.payload }
      case 'test/fetchData/rejected':
        return { ...state, loading: false, error: action.error.message }
      default:
        return state
    }
  }

  describe('pending state', () => {
    it('dispatches pending action when async thunk is called', async () => {
      const store = createStore(reducer, applyMiddleware(thunk))
      const dispatchedActions: any[] = []

      const loggingMiddleware =
        (_store: any) => (next: any) => (action: any) => {
          if (typeof action !== 'function') {
            dispatchedActions.push(action)
          }
          return next(action)
        }

      const storeWithLogging = createStore(
        reducer,
        applyMiddleware(thunk, loggingMiddleware),
      )

      const fetchData = createAsyncThunk(
        'test/fetchData',
        async () => {
          return 'test data'
        },
      )

      await storeWithLogging.dispatch(fetchData())

      expect(dispatchedActions[0].type).toBe('test/fetchData/pending')
      expect(dispatchedActions[0].meta.requestStatus).toBe('pending')
      expect(dispatchedActions[0].meta.arg).toBeUndefined()
    })

    it('includes arg in pending action meta when thunk is called with arguments', async () => {
      const dispatchedActions: any[] = []

      const loggingMiddleware =
        (_store: any) => (next: any) => (action: any) => {
          if (typeof action !== 'function') {
            dispatchedActions.push(action)
          }
          return next(action)
        }

      const storeWithLogging = createStore(
        reducer,
        applyMiddleware(thunk, loggingMiddleware),
      )

      const fetchData = createAsyncThunk(
        'test/fetchData',
        async (id: number) => {
          return `data-${id}`
        },
      )

      await storeWithLogging.dispatch(fetchData(123))

      expect(dispatchedActions[0].type).toBe('test/fetchData/pending')
      expect(dispatchedActions[0].meta.arg).toBe(123)
      expect(dispatchedActions[0].meta.requestId).toBeDefined()
    })
  })

  describe('fulfilled state', () => {
    it('dispatches fulfilled action with payload on success', async () => {
      const dispatchedActions: any[] = []

      const loggingMiddleware =
        (_store: any) => (next: any) => (action: any) => {
          if (typeof action !== 'function') {
            dispatchedActions.push(action)
          }
          return next(action)
        }

      const storeWithLogging = createStore(
        reducer,
        applyMiddleware(thunk, loggingMiddleware),
      )

      const fetchData = createAsyncThunk(
        'test/fetchData',
        async () => {
          return 'success data'
        },
      )

      const result = await storeWithLogging.dispatch(fetchData())

      expect(dispatchedActions).toHaveLength(2)
      expect(dispatchedActions[1].type).toBe('test/fetchData/fulfilled')
      expect(dispatchedActions[1].payload).toBe('success data')
      expect(dispatchedActions[1].meta.requestStatus).toBe('fulfilled')
      expect(result.type).toBe('test/fetchData/fulfilled')
      expect(result.payload).toBe('success data')
    })

    it('updates store state correctly on fulfilled', async () => {
      const store = createStore(reducer, applyMiddleware(thunk))

      const fetchData = createAsyncThunk(
        'test/fetchData',
        async () => {
          return 'loaded data'
        },
      )

      await store.dispatch(fetchData())

      expect(store.getState().loading).toBe(false)
      expect(store.getState().data).toBe('loaded data')
      expect(store.getState().error).toBe(null)
    })

    it('passes dispatch, getState, and extra to payloadCreator', async () => {
      const extraArg = { api: 'https://api.example.com' }
      const dispatchedActions: any[] = []

      const loggingMiddleware =
        (_store: any) => (next: any) => (action: any) => {
          if (typeof action !== 'function') {
            dispatchedActions.push(action)
          }
          return next(action)
        }

      const storeWithLogging = createStore(
        reducer,
        applyMiddleware(
          withExtraArgument(extraArg),
          loggingMiddleware,
        ),
      )

      const fetchData = createAsyncThunk<
        string,
        void,
        TestState,
        { api: string }
      >(
        'test/fetchData',
        async (_, thunkApi) => {
          expect(thunkApi.dispatch).toBeDefined()
          expect(thunkApi.getState).toBeDefined()
          expect(thunkApi.extra).toBe(extraArg)
          expect(thunkApi.requestId).toBeDefined()
          expect(thunkApi.rejectWithValue).toBeDefined()
          return `api: ${thunkApi.extra.api}`
        },
      )

      await storeWithLogging.dispatch(fetchData())

      expect(dispatchedActions[1].payload).toBe('api: https://api.example.com')
    })
  })

  describe('rejected state', () => {
    it('dispatches rejected action with error on failure', async () => {
      const dispatchedActions: any[] = []

      const loggingMiddleware =
        (_store: any) => (next: any) => (action: any) => {
          if (typeof action !== 'function') {
            dispatchedActions.push(action)
          }
          return next(action)
        }

      const storeWithLogging = createStore(
        reducer,
        applyMiddleware(thunk, loggingMiddleware),
      )

      const testError = new Error('Network error')

      const fetchData = createAsyncThunk(
        'test/fetchData',
        async () => {
          throw testError
        },
      )

      const result = await storeWithLogging.dispatch(fetchData())

      expect(dispatchedActions).toHaveLength(2)
      expect(dispatchedActions[1].type).toBe('test/fetchData/rejected')
      expect(dispatchedActions[1].error.message).toBe('Network error')
      expect(dispatchedActions[1].error.name).toBe('Error')
      expect(dispatchedActions[1].meta.requestStatus).toBe('rejected')
      expect(dispatchedActions[1].meta.rejectedWithValue).toBe(false)
      expect(result.type).toBe('test/fetchData/rejected')
      expect(result.error.message).toBe('Network error')
    })

    it('updates store state correctly on rejected', async () => {
      const store = createStore(reducer, applyMiddleware(thunk))

      const fetchData = createAsyncThunk(
        'test/fetchData',
        async () => {
          throw new Error('Fetch failed')
        },
      )

      await store.dispatch(fetchData())

      expect(store.getState().loading).toBe(false)
      expect(store.getState().data).toBe(null)
      expect(store.getState().error).toBe('Fetch failed')
    })

    it('handles rejectWithValue for custom error payloads', async () => {
      const dispatchedActions: any[] = []

      const loggingMiddleware =
        (_store: any) => (next: any) => (action: any) => {
          if (typeof action !== 'function') {
            dispatchedActions.push(action)
          }
          return next(action)
        }

      const storeWithLogging = createStore(
        reducer,
        applyMiddleware(thunk, loggingMiddleware),
      )

      interface CustomError {
        code: number
        message: string
      }

      const fetchData = createAsyncThunk<
        string,
        void,
        TestState,
        undefined,
        any,
        CustomError
      >(
        'test/fetchData',
        async (_, thunkApi) => {
          throw thunkApi.rejectWithValue(
            {
              code: 404,
              message: 'Not found',
            },
            new Error('Resource not found'),
          )
        },
      )

      const result = await storeWithLogging.dispatch(fetchData())

      expect(dispatchedActions[1].type).toBe('test/fetchData/rejected')
      expect(dispatchedActions[1].payload).toEqual({
        code: 404,
        message: 'Not found',
      })
      expect(dispatchedActions[1].meta.rejectedWithValue).toBe(true)
      expect(result.payload).toEqual({ code: 404, message: 'Not found' })
    })

    it('serializes non-Error objects correctly', async () => {
      const dispatchedActions: any[] = []

      const loggingMiddleware =
        (_store: any) => (next: any) => (action: any) => {
          if (typeof action !== 'function') {
            dispatchedActions.push(action)
          }
          return next(action)
        }

      const storeWithLogging = createStore(
        reducer,
        applyMiddleware(thunk, loggingMiddleware),
      )

      const fetchData = createAsyncThunk(
        'test/fetchData',
        async () => {
          throw { message: 'Custom error', code: 'CUSTOM_ERR' }
        },
      )

      await storeWithLogging.dispatch(fetchData())

      expect(dispatchedActions[1].error.message).toBe('Custom error')
      expect(dispatchedActions[1].error.code).toBe('CUSTOM_ERR')
    })
  })

  describe('action creator properties', () => {
    it('has pending, fulfilled, rejected action creators attached', () => {
      const fetchData = createAsyncThunk(
        'test/fetchData',
        async () => 'data',
      )

      expect(typeof fetchData.pending).toBe('function')
      expect(typeof fetchData.fulfilled).toBe('function')
      expect(typeof fetchData.rejected).toBe('function')
      expect(fetchData.typePrefix).toBe('test/fetchData')

      const pendingAction = fetchData.pending('req-1', 'arg1')
      expect(pendingAction.type).toBe('test/fetchData/pending')
      expect(pendingAction.meta.requestId).toBe('req-1')
      expect(pendingAction.meta.arg).toBe('arg1')

      const fulfilledAction = fetchData.fulfilled('result', 'req-2', 'arg2')
      expect(fulfilledAction.type).toBe('test/fetchData/fulfilled')
      expect(fulfilledAction.payload).toBe('result')

      const rejectedAction = fetchData.rejected(
        new Error('fail'),
        'req-3',
        'arg3',
      )
      expect(rejectedAction.type).toBe('test/fetchData/rejected')
      expect(rejectedAction.error.message).toBe('fail')
    })
  })

  describe('requestId', () => {
    it('generates unique requestIds for each dispatch', async () => {
      const dispatchedActions: any[] = []

      const loggingMiddleware =
        (_store: any) => (next: any) => (action: any) => {
          if (typeof action !== 'function') {
            dispatchedActions.push(action)
          }
          return next(action)
        }

      const storeWithLogging = createStore(
        reducer,
        applyMiddleware(thunk, loggingMiddleware),
      )

      const fetchData = createAsyncThunk(
        'test/fetchData',
        async () => 'data',
      )

      await Promise.all([
        storeWithLogging.dispatch(fetchData()),
        storeWithLogging.dispatch(fetchData()),
      ])

      const requestIds = dispatchedActions
        .filter(a => a.meta?.requestStatus === 'pending')
        .map(a => a.meta.requestId)

      expect(requestIds[0]).not.toBe(requestIds[1])
    })
  })
})
