import { Action, PayloadAction } from '@reduxjs/toolkit';

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
