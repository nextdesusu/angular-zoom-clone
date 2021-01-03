import { Component, OnInit, ViewChild, ElementRef, Input } from '@angular/core';

@Component({
  selector: 'app-video',
  templateUrl: './video.component.html',
  styleUrls: ['./video.component.css']
})
export class VideoComponent implements OnInit {
  @Input() stream: MediaStream;
  @ViewChild("videoElem", { static: true }) videoElem: ElementRef;
  constructor() { }

  ngOnInit(): void {
    this.videoElem.nativeElement.srcObject = this.stream;
  }

}
