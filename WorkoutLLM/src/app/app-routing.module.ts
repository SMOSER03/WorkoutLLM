import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AppComponent } from './app.component';
import { ChatComponent } from './core/components/chat/chat.component';
import { LandingComponent } from './core/components/landing/landing.component';
import { ParticipantsComponent } from './core/components/participants/participants.component';

const routes: Routes = [
  { path: '', component: LandingComponent },      // home
  { path: 'chat', component: ChatComponent },  // chat page
  { path: 'participants', component: ParticipantsComponent} //participants page
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {}
