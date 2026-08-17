import { bootstrapApplication } from '@angular/platform-browser';

import { appConfig } from './app/app.config';
import { AppComponent } from './app/main/commons/main-module/components/app/app.component';

bootstrapApplication(AppComponent, appConfig).catch((error: unknown) => console.error(error));
