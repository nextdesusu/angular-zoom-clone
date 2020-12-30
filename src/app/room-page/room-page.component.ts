import {
  Component,
  OnInit,
  ViewChild,
  ElementRef
} from '@angular/core';

import WEBRTC from "../../WEBRTC";

@Component({
  selector: 'app-room-page',
  templateUrl: './room-page.component.html',
  styleUrls: ['./room-page.component.css']
})
export class RoomPageComponent implements OnInit {
  @ViewChild("hostStream", { static: true }) hostStream: ElementRef;
  @ViewChild("clientStream", { static: true }) clientStream: ElementRef;
  private userName: string = `desu: ${Math.random()}`;
  private connection: WEBRTC = null;
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
    this.connection = new WEBRTC(this.userName, this.hostStream.nativeElement);
  }
}
