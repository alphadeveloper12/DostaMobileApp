import { registerRootComponent } from 'expo';
import App from './App';

// Surface any uncaught JS error in the Metro terminal (helps diagnose crashes
// that otherwise just bounce back to the Expo Go home screen). The original
// handler is preserved so the red box / native reporting still works.
if (global.ErrorUtils?.getGlobalHandler) {
  const previousHandler = global.ErrorUtils.getGlobalHandler();
  global.ErrorUtils.setGlobalHandler((error, isFatal) => {
    console.error(`[GlobalError]${isFatal ? ' FATAL:' : ':'}`, error?.message, error?.stack);
    previousHandler?.(error, isFatal);
  });
}

registerRootComponent(App);
