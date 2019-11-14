import { call, put, putResolve } from 'redux-saga/effects'
import { createAction }          from 'redux-actions'
import isFunction                from 'lodash/isFunction'
import merge                     from 'lodash/merge'

//
// Internal helpers
//
const isTriggerAction     = action => action.meta?.promise?.resolvedAction
const resolvePromise      = (action, value) => action.meta.promise.resolve(value)
const rejectPromise       = (action, error) => action.meta.promise.reject(error)
const verifyTriggerAction = (action, method) => { if (!isTriggerAction(action)) throw new Error(`redux-saga-promise: ${method}: first argument must be promise trigger action, got ${action}`) }

//
// createPromiseAction() creates the suite of actions
//
// The trigger action uses the passed payload & meta functions, and it
// appends a `promise` object to the meta.  The promise object includes
// other actions of the suite, and later on the middleware will add to it
// functions to resolve and reject the promise.
//
export function createPromiseAction (prefix, payload, meta) {
  const createStage = (type, payload, meta) => createAction(`${prefix}.${type}`, payload, meta)
  const resolvedAction = createStage('RESOLVED')
  const rejectedAction = createStage('REJECTED')
  const trigger        = createStage('TRIGGER', payload, (...args) => merge(meta?.(...args), { promise: { resolvedAction, rejectedAction } }))
  const suite    = trigger
  suite.trigger  = trigger
  suite.resolved = resolvedAction
  suite.rejected = rejectedAction
  return suite
}

//
// Sagas to resolve & reject the promise
//
export function * implementPromiseAction (action, body) {
  verifyTriggerAction(action, 'implementPromiseAction')
  try {
    resolvePromise(action, yield call(body))
  } catch (error) {
    rejectPromise(action, error)
  }
}

export function * resolvePromiseAction (action, value) {
  verifyTriggerAction(action, 'resolvePromiseAction')
  resolvePromise(action, value)
}

export function * rejectPromiseAction (action, error) {
  verifyTriggerAction(action, 'rejectPromiseAction')
  rejectPromise(action, error)
}

//
// dispatch() effect creator
//
// Convenience redux-saga effect creator that chooses put() or putResolve()
// based on whether the action is a promise action.  Also allows passing
// the action creator and payload separately
//
export function dispatch (action, args) {
  if (isFunction(action)) {
    action = action(args)
  } else if (action == null) {
    throw new Error('redux-saga-promise: null action passed to dispatch() effect creator')
  } else if (args !== undefined) {
    throw new Error('redux-saga-promise: extra args passed to dispatch() effect creator')
  }
  return isTriggerAction(action) ? putResolve(action) : put(action)
}

//
// promiseMiddleware
//
// For a trigger action a promise is created and returned, and the action's
// meta.promise is augmented with resolve() and reject() functions for use
// by the sagas.  (This middleware must come before sagaMiddleware so that
// the sagas will have those functions available.)
//
// Other actions are passed through unmolested
//
export const promiseMiddleware = store => next => (action) => {
  if (isTriggerAction(action)) {
    return new Promise((resolve, reject) => next(merge(action, {
      meta: {
        promise: {
          resolve: (value) => {
            resolve(value)
            store.dispatch(action.meta.promise.resolvedAction(value))
          },
          reject: (error) => {
            reject(error)
            store.dispatch(action.meta.promise.rejectedAction(error))
          },
        },
      },
    })))
  }
  return next(action)
}
