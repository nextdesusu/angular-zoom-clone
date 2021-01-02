import {
  Component,
  OnInit,
  ViewChild,
  ElementRef
} from '@angular/core';

import WEBRTC, { UserStream } from "../../WEBRTC";

@Component({
  selector: 'app-room-page',
  templateUrl: './room-page.component.html',
  styleUrls: ['./room-page.component.css']
})
export class RoomPageComponent implements OnInit {
  private userName: string = `desu: ${Math.random()}`;
  public connection: WEBRTC = null;
  private targetRoom: string = "";

  constructor() { }

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
  }
}
