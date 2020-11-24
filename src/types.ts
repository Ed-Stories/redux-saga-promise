import {
  Action,
  ActionCreatorWithPayload,
  ActionCreatorWithPreparedPayload,
  PayloadAction,
  PrepareAction,
} from '@reduxjs/toolkit';

export type Meta<T> = {
  promise: {
    resolve: (value: T) => void;
    reject: (error: Error) => void;
    resolvedAction: (value: T) => PayloadAction<T>;
    rejectedAction: (error: Error) => PayloadAction<Error>;
  };
};

export type TriggerAction<T> = Action<string> & {
  meta: Meta<T>;
};

export interface StageCreator {
  <P = void>(type: string, prepareAction: PrepareAction<P>): ActionCreatorWithPreparedPayload<any[], P>;
  <P = void>(type: string): ActionCreatorWithPayload<P>;
}
