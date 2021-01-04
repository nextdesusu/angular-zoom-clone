import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { RoomPageComponent } from './room-page/room-page.component';

const routes: Routes = [{ path: ":id", component: RoomPageComponent }];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
