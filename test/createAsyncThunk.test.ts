import { applyMiddleware, createStore } from 'redux'
import { thunk, createAsyncThunk, withExtraArgument } from 'redux-thunk'

function createLoggingStore(reducer: any) {
  const dispatchedActions: any[] = []
  const loggingMiddleware =
    (_store: any) => (next: any) => (action: any) => {
      if (typeof action !== 'function') {
        dispatchedActions.push(action)
      }
      return next(action)
    }
  const store = createStore(reducer, applyMiddleware(thunk, loggingMiddleware))
  return { store, dispatchedActions }
}

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
      const { store, dispatchedActions } = createLoggingStore(reducer)

      const fetchData = createAsyncThunk(
        'test/fetchData',
        async () => 'test data',
      )

      await store.dispatch(fetchData())

      expect(dispatchedActions[0].type).toBe('test/fetchData/pending')
      expect(dispatchedActions[0].meta.requestStatus).toBe('pending')
      expect(dispatchedActions[0].meta.arg).toBeUndefined()
    })

    it('includes arg in pending action meta when thunk is called with arguments', async () => {
      const { store, dispatchedActions } = createLoggingStore(reducer)

      const fetchData = createAsyncThunk(
        'test/fetchData',
        async (id: number) => `data-${id}`,
      )

      await store.dispatch(fetchData(123))

      expect(dispatchedActions[0].type).toBe('test/fetchData/pending')
      expect(dispatchedActions[0].meta.arg).toBe(123)
      expect(dispatchedActions[0].meta.requestId).toBeDefined()
    })

    it('dispatches pending before async work begins', async () => {
      let pendingDispatched = false
      let asyncStarted = false

      const { store, dispatchedActions } = createLoggingStore(reducer)

      const fetchData = createAsyncThunk(
        'test/fetchData',
        async () => {
          asyncStarted = true
          return 'data'
        },
      )

      const promise = store.dispatch(fetchData())

      expect(dispatchedActions[0].type).toBe('test/fetchData/pending')
      pendingDispatched = true

      await promise

      expect(pendingDispatched).toBe(true)
      expect(asyncStarted).toBe(true)
    })
  })

  describe('fulfilled state', () => {
    it('dispatches fulfilled action with payload on success', async () => {
      const { store, dispatchedActions } = createLoggingStore(reducer)

      const fetchData = createAsyncThunk(
        'test/fetchData',
        async () => 'success data',
      )

      const result: any = await store.dispatch(fetchData())

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
        async () => 'loaded data',
      )

      await store.dispatch(fetchData())

      expect(store.getState().loading).toBe(false)
      expect(store.getState().data).toBe('loaded data')
      expect(store.getState().error).toBe(null)
    })

    it('fulfilled action includes correct meta', async () => {
      const { store, dispatchedActions } = createLoggingStore(reducer)

      const fetchData = createAsyncThunk(
        'test/fetchData',
        async (id: string) => `result-${id}`,
      )

      await store.dispatch(fetchData('abc'))

      const fulfilledAction = dispatchedActions.find(
        a => a.meta?.requestStatus === 'fulfilled',
      )
      expect(fulfilledAction.meta.arg).toBe('abc')
      expect(fulfilledAction.meta.requestId).toBeDefined()
      expect(fulfilledAction.payload).toBe('result-abc')
    })

    it('returns complex payload types', async () => {
      const { store, dispatchedActions } = createLoggingStore(reducer)

      const fetchData = createAsyncThunk(
        'test/fetchData',
        async () => ({ items: [1, 2, 3], total: 3 }),
      )

      await store.dispatch(fetchData())

      expect(dispatchedActions[1].payload).toEqual({
        items: [1, 2, 3],
        total: 3,
      })
    })
  })

  describe('rejected state', () => {
    it('dispatches rejected action with error on failure', async () => {
      const { store, dispatchedActions } = createLoggingStore(reducer)

      const fetchData = createAsyncThunk(
        'test/fetchData',
        async () => {
          throw new Error('Network error')
        },
      )

      const result: any = await store.dispatch(fetchData())

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

    it('handles rejectWithValue thrown with custom error payloads', async () => {
      const { store, dispatchedActions } = createLoggingStore(reducer)

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
            { code: 404, message: 'Not found' },
            new Error('Resource not found'),
          )
        },
      )

      const result: any = await store.dispatch(fetchData())

      expect(dispatchedActions[1].type).toBe('test/fetchData/rejected')
      expect(dispatchedActions[1].payload).toEqual({
        code: 404,
        message: 'Not found',
      })
      expect(dispatchedActions[1].meta.rejectedWithValue).toBe(true)
      expect(result.payload).toEqual({ code: 404, message: 'Not found' })
    })

    it('handles rejectWithValue returned (not thrown)', async () => {
      const { store, dispatchedActions } = createLoggingStore(reducer)

      const fetchData = createAsyncThunk<
        string,
        void,
        TestState,
        undefined,
        any,
        string
      >(
        'test/fetchData',
        async (_, thunkApi) => {
          return thunkApi.rejectWithValue('Custom error value') as any
        },
      )

      const result: any = await store.dispatch(fetchData())

      expect(dispatchedActions[1].type).toBe('test/fetchData/rejected')
      expect(dispatchedActions[1].payload).toBe('Custom error value')
      expect(dispatchedActions[1].meta.rejectedWithValue).toBe(true)
      expect(result.payload).toBe('Custom error value')
    })

    it('serializes non-Error objects correctly', async () => {
      const { store, dispatchedActions } = createLoggingStore(reducer)

      const fetchData = createAsyncThunk(
        'test/fetchData',
        async () => {
          throw { message: 'Custom error', code: 'CUSTOM_ERR' }
        },
      )

      await store.dispatch(fetchData())

      expect(dispatchedActions[1].error.message).toBe('Custom error')
      expect(dispatchedActions[1].error.code).toBe('CUSTOM_ERR')
    })

    it('serializes null/undefined errors with defaults', async () => {
      const { store, dispatchedActions } = createLoggingStore(reducer)

      const fetchData = createAsyncThunk(
        'test/fetchData',
        async () => {
          throw null
        },
      )

      await store.dispatch(fetchData())

      expect(dispatchedActions[1].error.message).toBe('Unknown error')
      expect(dispatchedActions[1].error.name).toBe('Error')
    })

    it('serializes Error with code property', async () => {
      const { store, dispatchedActions } = createLoggingStore(reducer)

      const fetchData = createAsyncThunk(
        'test/fetchData',
        async () => {
          const err = new Error('timeout')
          err.name = 'TimeoutError'
          ;(err as any).code = 'ETIMEDOUT'
          throw err
        },
      )

      await store.dispatch(fetchData())

      expect(dispatchedActions[1].error.name).toBe('TimeoutError')
      expect(dispatchedActions[1].error.message).toBe('timeout')
      expect(dispatchedActions[1].error.code).toBe('ETIMEDOUT')
    })

    it('rejected action meta.condition is false for normal errors', async () => {
      const { store, dispatchedActions } = createLoggingStore(reducer)

      const fetchData = createAsyncThunk(
        'test/fetchData',
        async () => {
          throw new Error('fail')
        },
      )

      await store.dispatch(fetchData())

      expect(dispatchedActions[1].meta.condition).toBe(false)
      expect(dispatchedActions[1].meta.aborted).toBe(false)
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
    })

    it('pending action creator produces correct action', () => {
      const fetchData = createAsyncThunk(
        'test/fetchData',
        async (_arg: string) => 'data',
      )

      const action = fetchData.pending('req-1', 'arg1')
      expect(action.type).toBe('test/fetchData/pending')
      expect(action.meta.requestId).toBe('req-1')
      expect(action.meta.arg).toBe('arg1')
      expect(action.meta.requestStatus).toBe('pending')
    })

    it('fulfilled action creator produces correct action', () => {
      const fetchData = createAsyncThunk(
        'test/fetchData',
        async (_arg: string) => 'data',
      )

      const action = fetchData.fulfilled('result', 'req-2', 'arg2')
      expect(action.type).toBe('test/fetchData/fulfilled')
      expect(action.payload).toBe('result')
      expect(action.meta.requestId).toBe('req-2')
      expect(action.meta.arg).toBe('arg2')
      expect(action.meta.requestStatus).toBe('fulfilled')
    })

    it('rejected action creator produces correct action', () => {
      const fetchData = createAsyncThunk(
        'test/fetchData',
        async (_arg: string) => 'data',
      )

      const action = fetchData.rejected(new Error('fail'), 'req-3', 'arg3')
      expect(action.type).toBe('test/fetchData/rejected')
      expect(action.error.message).toBe('fail')
      expect(action.meta.requestId).toBe('req-3')
      expect(action.meta.arg).toBe('arg3')
      expect(action.meta.requestStatus).toBe('rejected')
    })

    it('rejected action creator with custom payload', () => {
      const fetchData = createAsyncThunk<string, void, any, any, any, string>(
        'test/fetchData',
        async () => 'data',
      )

      const action = fetchData.rejected(
        new Error('fail'),
        'req-4',
        undefined,
        'custom payload',
      )
      expect(action.payload).toBe('custom payload')
      expect(action.meta.rejectedWithValue).toBe(true)
    })
  })

  describe('requestId', () => {
    it('generates unique requestIds for each dispatch', async () => {
      const { store, dispatchedActions } = createLoggingStore(reducer)

      const fetchData = createAsyncThunk(
        'test/fetchData',
        async () => 'data',
      )

      await Promise.all([
        store.dispatch(fetchData()),
        store.dispatch(fetchData()),
      ])

      const requestIds = dispatchedActions
        .filter(a => a.meta?.requestStatus === 'pending')
        .map(a => a.meta.requestId)

      expect(requestIds[0]).not.toBe(requestIds[1])
    })

    it('uses custom idGenerator when provided', async () => {
      const { store, dispatchedActions } = createLoggingStore(reducer)

      let counter = 0
      const fetchData = createAsyncThunk(
        'test/fetchData',
        async () => 'data',
        {
          idGenerator: () => `custom-id-${++counter}`,
        },
      )

      await store.dispatch(fetchData())

      expect(dispatchedActions[0].meta.requestId).toBe('custom-id-1')
    })

    it('passes arg to idGenerator', async () => {
      const { store, dispatchedActions } = createLoggingStore(reducer)

      const fetchData = createAsyncThunk(
        'test/fetchData',
        async () => 'data',
        {
          idGenerator: (arg: string) => `id-for-${arg}`,
        },
      )

      await store.dispatch(fetchData('myArg'))

      expect(dispatchedActions[0].meta.requestId).toBe('id-for-myArg')
    })
  })

  describe('condition option', () => {
    it('skips all dispatches when condition returns false', async () => {
      const { store, dispatchedActions } = createLoggingStore(reducer)

      const fetchData = createAsyncThunk(
        'test/fetchData',
        async () => 'data',
        {
          condition: () => false,
        },
      )

      const result: any = await store.dispatch(fetchData())

      expect(dispatchedActions).toHaveLength(0)
      expect(result.meta.condition).toBe(true)
      expect(result.meta.requestStatus).toBe('rejected')
    })

    it('executes normally when condition returns true', async () => {
      const { store, dispatchedActions } = createLoggingStore(reducer)

      const fetchData = createAsyncThunk(
        'test/fetchData',
        async () => 'data',
        {
          condition: () => true,
        },
      )

      await store.dispatch(fetchData())

      expect(dispatchedActions).toHaveLength(2)
      expect(dispatchedActions[0].type).toBe('test/fetchData/pending')
      expect(dispatchedActions[1].type).toBe('test/fetchData/fulfilled')
    })

    it('executes normally when condition returns undefined', async () => {
      const { store, dispatchedActions } = createLoggingStore(reducer)

      const fetchData = createAsyncThunk(
        'test/fetchData',
        async () => 'data',
        {
          condition: () => undefined,
        },
      )

      await store.dispatch(fetchData())

      expect(dispatchedActions).toHaveLength(2)
      expect(dispatchedActions[1].type).toBe('test/fetchData/fulfilled')
    })

    it('dispatches rejected with condition=true when dispatchConditionRejection is true', async () => {
      const { store, dispatchedActions } = createLoggingStore(reducer)

      const fetchData = createAsyncThunk(
        'test/fetchData',
        async () => 'data',
        {
          condition: () => false,
          dispatchConditionRejection: true,
        },
      )

      await store.dispatch(fetchData())

      expect(dispatchedActions).toHaveLength(1)
      expect(dispatchedActions[0].type).toBe('test/fetchData/rejected')
      expect(dispatchedActions[0].meta.condition).toBe(true)
    })

    it('does not dispatch rejected when dispatchConditionRejection is false', async () => {
      const { store, dispatchedActions } = createLoggingStore(reducer)

      const fetchData = createAsyncThunk(
        'test/fetchData',
        async () => 'data',
        {
          condition: () => false,
          dispatchConditionRejection: false,
        },
      )

      await store.dispatch(fetchData())

      expect(dispatchedActions).toHaveLength(0)
    })

    it('receives arg and getState in condition callback', async () => {
      const { store, dispatchedActions } = createLoggingStore(reducer)
      let receivedArg: any
      let receivedGetState: any

      const fetchData = createAsyncThunk(
        'test/fetchData',
        async (_arg: string) => 'data',
        {
          condition: (arg, { getState }) => {
            receivedArg = arg
            receivedGetState = getState
            return true
          },
        },
      )

      await store.dispatch(fetchData('test-arg'))

      expect(receivedArg).toBe('test-arg')
      expect(typeof receivedGetState).toBe('function')
    })

    it('can access current state in condition callback', async () => {
      const store = createStore(reducer, applyMiddleware(thunk))
      let stateInCondition: any

      const fetchData = createAsyncThunk(
        'test/fetchData',
        async () => 'data',
        {
          condition: (_, { getState }) => {
            stateInCondition = getState()
            return true
          },
        },
      )

      await store.dispatch(fetchData())

      expect(stateInCondition).toEqual(initialState)
    })

    it('prevents async execution when condition returns false', async () => {
      let payloadCreatorCalled = false

      const fetchData = createAsyncThunk(
        'test/fetchData',
        async () => {
          payloadCreatorCalled = true
          return 'data'
        },
        {
          condition: () => false,
        },
      )

      const store = createStore(reducer, applyMiddleware(thunk))
      await store.dispatch(fetchData())

      expect(payloadCreatorCalled).toBe(false)
    })
  })

  describe('thunkApi', () => {
    it('provides dispatch in payloadCreator', async () => {
      const { store, dispatchedActions } = createLoggingStore(reducer)

      const fetchData = createAsyncThunk(
        'test/fetchData',
        async (_, thunkApi) => {
          thunkApi.dispatch({ type: 'custom/action' })
          return 'data'
        },
      )

      await store.dispatch(fetchData())

      const customAction = dispatchedActions.find(
        a => a.type === 'custom/action',
      )
      expect(customAction).toBeDefined()
    })

    it('provides getState in payloadCreator', async () => {
      const store = createStore(reducer, applyMiddleware(thunk))
      let stateInPayload: any

      const fetchData = createAsyncThunk(
        'test/fetchData',
        async (_, thunkApi) => {
          stateInPayload = thunkApi.getState()
          return 'data'
        },
      )

      await store.dispatch(fetchData())

      expect(stateInPayload.loading).toBe(true)
      expect(stateInPayload.data).toBe(null)
      expect(stateInPayload.error).toBe(null)
    })

    it('provides extra argument via payloadCreator', async () => {
      const extraArg = { api: 'https://api.example.com' }
      const { store, dispatchedActions } = createLoggingStore(reducer)

      const storeWithExtra = createStore(
        reducer,
        applyMiddleware(withExtraArgument(extraArg)),
      )

      let receivedExtra: any
      const fetchData = createAsyncThunk<
        string,
        void,
        TestState,
        { api: string }
      >('test/fetchData', async (_, thunkApi) => {
        receivedExtra = thunkApi.extra
        return `api: ${thunkApi.extra.api}`
      })

      await storeWithExtra.dispatch(fetchData())

      expect(receivedExtra).toBe(extraArg)
      expect(receivedExtra.api).toBe('https://api.example.com')
    })

    it('provides requestId in payloadCreator', async () => {
      const store = createStore(reducer, applyMiddleware(thunk))
      let requestIdInPayload: string

      const fetchData = createAsyncThunk(
        'test/fetchData',
        async (_, thunkApi) => {
          requestIdInPayload = thunkApi.requestId
          return 'data'
        },
      )

      await store.dispatch(fetchData())

      expect(requestIdInPayload!).toBeDefined()
      expect(typeof requestIdInPayload!).toBe('string')
    })

    it('provides signal (AbortSignal) in payloadCreator', async () => {
      const store = createStore(reducer, applyMiddleware(thunk))
      let signalInPayload: AbortSignal

      const fetchData = createAsyncThunk(
        'test/fetchData',
        async (_, thunkApi) => {
          signalInPayload = thunkApi.signal
          return 'data'
        },
      )

      await store.dispatch(fetchData())

      expect(signalInPayload!).toBeInstanceOf(AbortSignal)
    })

    it('provides rejectWithValue in payloadCreator', async () => {
      const store = createStore(reducer, applyMiddleware(thunk))
      let rejectFn: any

      const fetchData = createAsyncThunk(
        'test/fetchData',
        async (_, thunkApi) => {
          rejectFn = thunkApi.rejectWithValue
          return 'data'
        },
      )

      await store.dispatch(fetchData())

      expect(typeof rejectFn!).toBe('function')
    })
  })

  describe('action dispatch order', () => {
    it('always dispatches pending before fulfilled', async () => {
      const { store, dispatchedActions } = createLoggingStore(reducer)

      const fetchData = createAsyncThunk(
        'test/fetchData',
        async () => 'data',
      )

      await store.dispatch(fetchData())

      const pendingIndex = dispatchedActions.findIndex(
        a => a.meta?.requestStatus === 'pending',
      )
      const fulfilledIndex = dispatchedActions.findIndex(
        a => a.meta?.requestStatus === 'fulfilled',
      )

      expect(pendingIndex).toBeLessThan(fulfilledIndex)
    })

    it('always dispatches pending before rejected', async () => {
      const { store, dispatchedActions } = createLoggingStore(reducer)

      const fetchData = createAsyncThunk(
        'test/fetchData',
        async () => {
          throw new Error('fail')
        },
      )

      await store.dispatch(fetchData())

      const pendingIndex = dispatchedActions.findIndex(
        a => a.meta?.requestStatus === 'pending',
      )
      const rejectedIndex = dispatchedActions.findIndex(
        a => a.meta?.requestStatus === 'rejected',
      )

      expect(pendingIndex).toBeLessThan(rejectedIndex)
    })
  })

  describe('return value', () => {
    it('returns fulfilled action on success', async () => {
      const store = createStore(reducer, applyMiddleware(thunk))

      const fetchData = createAsyncThunk(
        'test/fetchData',
        async (val: string) => `result: ${val}`,
      )

      const result: any = await store.dispatch(fetchData('hello'))

      expect(result.type).toBe('test/fetchData/fulfilled')
      expect(result.payload).toBe('result: hello')
      expect(result.meta.arg).toBe('hello')
    })

    it('returns rejected action on failure', async () => {
      const store = createStore(reducer, applyMiddleware(thunk))

      const fetchData = createAsyncThunk(
        'test/fetchData',
        async () => {
          throw new Error('fail')
        },
      )

      const result: any = await store.dispatch(fetchData())

      expect(result.type).toBe('test/fetchData/rejected')
      expect(result.error.message).toBe('fail')
    })

    it('returns rejected action with condition=true when condition fails', async () => {
      const store = createStore(reducer, applyMiddleware(thunk))

      const fetchData = createAsyncThunk(
        'test/fetchData',
        async () => 'data',
        {
          condition: () => false,
        },
      )

      const result: any = await store.dispatch(fetchData())

      expect(result.type).toBe('test/fetchData/rejected')
      expect(result.meta.condition).toBe(true)
    })
  })

  describe('multiple thunks', () => {
    it('different typePrefixes produce different action types', async () => {
      const { store, dispatchedActions } = createLoggingStore(reducer)

      const fetchUsers = createAsyncThunk(
        'users/fetch',
        async () => ['user1', 'user2'],
      )

      const fetchPosts = createAsyncThunk(
        'posts/fetch',
        async () => ['post1', 'post2'],
      )

      await store.dispatch(fetchUsers())
      await store.dispatch(fetchPosts())

      const userActions = dispatchedActions.filter(a =>
        a.type.startsWith('users/'),
      )
      const postActions = dispatchedActions.filter(a =>
        a.type.startsWith('posts/'),
      )

      expect(userActions).toHaveLength(2)
      expect(postActions).toHaveLength(2)
    })

    it('sequential dispatches work correctly', async () => {
      const store = createStore(reducer, applyMiddleware(thunk))

      const fetchData = createAsyncThunk(
        'test/fetchData',
        async (val: string) => val,
      )

      await store.dispatch(fetchData('first'))
      expect(store.getState().data).toBe('first')

      await store.dispatch(fetchData('second'))
      expect(store.getState().data).toBe('second')
    })
  })

  describe('edge cases', () => {
    it('handles payload returning null', async () => {
      const { store, dispatchedActions } = createLoggingStore(reducer)

      const fetchData = createAsyncThunk(
        'test/fetchData',
        async () => null,
      )

      const result: any = await store.dispatch(fetchData())

      expect(result.type).toBe('test/fetchData/fulfilled')
      expect(result.payload).toBeNull()
    })

    it('handles payload returning undefined', async () => {
      const { store, dispatchedActions } = createLoggingStore(reducer)

      const fetchData = createAsyncThunk(
        'test/fetchData',
        async () => undefined,
      )

      const result: any = await store.dispatch(fetchData())

      expect(result.type).toBe('test/fetchData/fulfilled')
      expect(result.payload).toBeUndefined()
    })

    it('handles payload returning 0 (falsy but valid)', async () => {
      const { store, dispatchedActions } = createLoggingStore(reducer)

      const fetchData = createAsyncThunk(
        'test/fetchData',
        async () => 0,
      )

      const result: any = await store.dispatch(fetchData())

      expect(result.type).toBe('test/fetchData/fulfilled')
      expect(result.payload).toBe(0)
    })

    it('handles payload returning empty string', async () => {
      const { store, dispatchedActions } = createLoggingStore(reducer)

      const fetchData = createAsyncThunk(
        'test/fetchData',
        async () => '',
      )

      const result: any = await store.dispatch(fetchData())

      expect(result.type).toBe('test/fetchData/fulfilled')
      expect(result.payload).toBe('')
    })

    it('handles payload returning boolean false', async () => {
      const { store, dispatchedActions } = createLoggingStore(reducer)

      const fetchData = createAsyncThunk(
        'test/fetchData',
        async () => false,
      )

      const result: any = await store.dispatch(fetchData())

      expect(result.type).toBe('test/fetchData/fulfilled')
      expect(result.payload).toBe(false)
    })

    it('does not confuse normal objects with rejectWithValue result', async () => {
      const { store, dispatchedActions } = createLoggingStore(reducer)

      const fetchData = createAsyncThunk(
        'test/fetchData',
        async () => ({ value: 'legit', error: 'also legit' }),
      )

      const result: any = await store.dispatch(fetchData())

      expect(result.type).toBe('test/fetchData/fulfilled')
      expect(result.payload).toEqual({ value: 'legit', error: 'also legit' })
    })

    it('works with void arg type', async () => {
      const { store, dispatchedActions } = createLoggingStore(reducer)

      const fetchData = createAsyncThunk('test/fetchData', async () => 'data')

      await store.dispatch(fetchData())

      expect(dispatchedActions[1].type).toBe('test/fetchData/fulfilled')
    })
  })
})
