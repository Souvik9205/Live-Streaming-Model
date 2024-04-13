import React, { useEffect } from "react";
import "./App.css";
import DID_API from "./api.json";

function App() {
  useEffect(() => {
    const key = DID_API.key;
    console.log(key);
  });

  return (
    <div id="content">
      <div id="video-wrapper">
        <div>
          <video id="video-element" width="400" height="400" autoPlay></video>
        </div>
      </div>

      <div id="buttons">
        <button id="connect-button" type="button">
          Connect
        </button>
        <button id="start-button" type="button">
          Start
        </button>
        <button id="destroy-button" type="button">
          Destroy
        </button>
      </div>

      <div id="status">
        ICE gathering status: <label id="ice-gathering-status-label"></label>
        <br />
        ICE status: <label id="ice-status-label"></label>
        <br />
        Peer connection status: <label id="peer-status-label"></label>
        <br />
        Signaling status: <label id="signaling-status-label"></label>
        <br />
        Streaming status: <label id="streaming-status-label"></label>
        <br />
      </div>
    </div>
  );
}

export default App;
