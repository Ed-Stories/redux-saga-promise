import { ActionCreator, AnyAction, createAction, Middleware, PrepareAction } from '@reduxjs/toolkit';
import { isFunction, merge } from 'lodash';
import { call, put, putResolve } from 'redux-saga/effects';
import { StageCreator, TriggerAction } from 'types';

const isTriggerAction = <T>(action: AnyAction): action is TriggerAction<T> =>
  action.meta?.promise.resolvedAction != null;

const isAction = (action: any): action is AnyAction => typeof action === 'object' && typeof action.type === 'string';

const resolvePromise = <T>(action: TriggerAction<T>, value: T) => action.meta.promise.resolve(value);

const rejectPromise = <T>(action: TriggerAction<T>, error: Error) => action.meta.promise.reject(error);

export class ArgumentError extends Error {}
export class ConfigurationError extends Error {}

const verify = (action: AnyAction, method: string) => {
  if (!isTriggerAction(action)) {
    throw new ArgumentError(
      `redux-saga-promise: ${method}: first argument must be promise trigger action, got ${action}`,
    );
  }

  if (!isFunction(action.meta.promise.resolve)) {
    throw new ConfigurationError(
      `redux-saga-promise: ${method}: Unable to execute
      it seems that promiseMiddleware has not been not included before SagaMiddleware`,
    );
  }
};

export const createPromiseAction = <P = void, T = void>(prefix: string, prepareAction?: PrepareAction<T>) => {
  const createStage: StageCreator = <S>(type: string, prepareAction?: PrepareAction<S>) => {
    const prefixedType = `${prefix}/${type}`;

    return prepareAction ? createAction(prefixedType, prepareAction) : createAction<S>(prefixedType);
  };

  const resolvedAction = createStage<P>('resolved');
  const rejectedAction = createStage<Error>('rejected');

  const trigger = createStage('trigger', (payload: T, ...args: any[]) => {
    const meta = {
      payload,
      meta: {
        promise: { resolvedAction, rejectedAction },
      },
    };

    return prepareAction ? merge(prepareAction(payload, ...args), meta) : meta;
  });

  return {
    trigger: trigger,
    resolved: resolvedAction,
    rejected: rejectedAction,
  };
};

export function* implementPromiseAction<T>(action: AnyAction, getBody: () => T) {
  verify(action, 'implementPromiseAction');

  if (isTriggerAction(action)) {
    try {
      resolvePromise(action, yield call(getBody));
    } catch (error) {
      rejectPromise(action, error);
    }
  }
}

export function* resolvePromiseAction<T>(action: AnyAction, value: T) {
  verify(action, 'resolvePromiseAction');

  if (isTriggerAction(action)) {
    resolvePromise(action, value);
  }
}

export function* rejectPromiseAction(action: AnyAction, error: Error) {
  verify(action, 'rejectPromiseAction');

  if (isTriggerAction(action)) {
    rejectPromise(action, error);
  }
}

export function dispatch(action: AnyAction | ActionCreator<AnyAction> | null, args: any) {
  let currentAction = action;

  if (isFunction(action)) {
    currentAction = action(args);
  } else if (action === null) {
    throw new ArgumentError('redux-saga-promise: null action passed to dispatch() effect creator');
  } else if (args !== undefined) {
    throw new ArgumentError('redux-saga-promise: extra args passed to dispatch() effect creator');
  }

  if (isAction(currentAction)) {
    return isTriggerAction(currentAction) ? putResolve(currentAction) : put(currentAction);
  }
}

export const promiseMiddleware: Middleware = (store) => (next) => <T>(action: AnyAction | TriggerAction<T>) => {
  if (isTriggerAction(action)) {
    return new Promise((resolve, reject) =>
      next(
        merge(action, {
          meta: {
            promise: {
              resolve: (value: T) => {
                resolve(value);
                store.dispatch(action.meta.promise.resolvedAction(value));
              },
              reject: (error: Error) => {
                reject(error);
                store.dispatch(action.meta.promise.rejectedAction(error));
              },
            },
          },
        }),
      ),
    );
  }

  return next(action);
};
