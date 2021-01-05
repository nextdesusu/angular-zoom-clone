import {
  Component,
  OnInit,
} from '@angular/core';
import { Router, RoutesRecognized } from '@angular/router';

import WEBRTC from "../../WEBRTC";

@Component({
  selector: 'app-room-page',
  templateUrl: './room-page.component.html',
  styleUrls: ['./room-page.component.css']
})
export class RoomPageComponent implements OnInit {
  private userName: string = `desu: ${Math.random()}`;
  public connection: WEBRTC = null;
  private targetRoom: string = "";

  constructor(private router: Router) {
  }

  handleRoomNameInput(event: InputEvent): void {
    const target = event.target as HTMLInputElement;
    this.targetRoom = target.value;
  }

  handleHost(): void {
    if (this.connection !== null) {
      this.connection.createRoom({
        name: this.targetRoom
      }, (roomName: string) => console.log("hosted", roomName));
    }
  }

  handleJoin(): void {
    if (this.connection !== null) {
      this.connection.joinByName(this.targetRoom);
    }
  }

  ngOnInit(): void {
    this.connection = new WEBRTC(this.userName);
    this.router.events.subscribe(val => {

      if (val instanceof RoutesRecognized) {
        const firstChild = val.state.root.firstChild;
        if (firstChild === null) return;
        const roomId = firstChild.params.id;
        console.log("room page id:", roomId);
        this.connection.join(roomId);
      }
    });
  }

  generateLink(): void {
    const { hostname } = window.location;
    const host = hostname === "localhost" ? "localhost:4200" : hostname;
    const link = `${host}/${this.connection.room}`;
    console.log("gotten link:", link);
    navigator.clipboard.writeText(link);
  }
}
