import { startApp } from './app';
import { loadWindowKey } from './io/window-key';

void loadWindowKey().then(startApp);
