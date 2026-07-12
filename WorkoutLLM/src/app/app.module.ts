import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';
import { ChatComponent } from './core/components/chat/chat.component';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { LandingComponent } from './core/components/landing/landing.component';
import { ParticipantsComponent } from './core/components/participants/participants.component'; // needed for ngModel

@NgModule({
  declarations: [
    AppComponent,  // only AppComponent here
    ChatComponent, LandingComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    FormsModule,
    HttpClientModule,
    ParticipantsComponent
  ],
  bootstrap: [AppComponent]
})
export class AppModule {}
