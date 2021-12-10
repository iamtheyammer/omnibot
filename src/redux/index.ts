import { applyMiddleware, createStore, Store } from "redux";
import { composeWithDevTools } from "remote-redux-devtools";
import createSagaMiddleware from "redux-saga";

import rootReducer from "./reducers/index";

const sagaMiddleware = createSagaMiddleware();

// for future use, if needed
const middlewares = [sagaMiddleware];

const composeEnhancers = composeWithDevTools({
  name: "Omnibot",
  port: 8000,
});

export const store = createStore(
  rootReducer,
  {},
  composeEnhancers(applyMiddleware(...middlewares))
);

export function connectToStore(c: (s: Store) => void): void {
  // @ts-expect-error: TypeScript can't verify c is a constructable object
  new c(store);
}

export const dispatch = store.dispatch;
