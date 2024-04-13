import React, { useState, useEffect } from "react";
import axios from "axios";
import "./App.css";
import DID_API from "./api.json";

function App() {
  if (DID_API.key == "🤫") {
    alert("Please put your api key inside ./api.json and restart..");
  }
  const RTCPeerConnection = (
    window.RTCPeerConnection ||
    window.webkitRTCPeerConnection ||
    window.mozRTCPeerConnection
  ).bind(window);

  const [peerConnection, setPeerConnection] = useState(null);
  const [streamId, setStreamId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [videoIsPlaying, setVideoIsPlaying] = useState(false);
  const [statsIntervalId, setStatsIntervalId] = useState(null);
  const [lastBytesReceived, setLastBytesReceived] = useState(0);

  const videoElement = document.getElementById("video-element");
  videoElement.setAttribute("playsinline", "");
  const peerStatusLabel = document.getElementById("peer-status-label");
  const iceStatusLabel = document.getElementById("ice-status-label");
  const iceGatheringStatusLabel = document.getElementById(
    "ice-gathering-status-label"
  );
  const signalingStatusLabel = document.getElementById(
    "signaling-status-label"
  );
  const streamingStatusLabel = document.getElementById(
    "streaming-status-label"
  );

  const presenterInputByService = {
    talks: {
      source_url: "https://d-id-public-bucket.s3.amazonaws.com/or-roman.jpg",
    },
    clips: {
      presenter_id: "rian-lZC6MmWfC1",
      driver_id: "mXra4jY38i",
    },
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const sessionResponse = await axios.post(
          `${DID_API.url}/${DID_API.service}/streams`,
          {
            // Provide necessary request data
          }
        );
        const {
          id: newStreamId,
          offer,
          ice_servers: iceServers,
          session_id: newSessionId,
        } = sessionResponse.data;
        setStreamId(newStreamId);
        setSessionId(newSessionId);

        const sessionClientAnswer = await createPeerConnection(
          offer,
          iceServers
        );

        // Handle other response data as needed
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    fetchData();

    return () => {
      // Cleanup function if needed
    };
  }, []);

  const handleConnect = async () => {
    if (peerConnection && peerConnection.connectionState === "connected") {
      return;
    }

    stopAllStreams();
    closePC();

    const sessionResponse = await fetchWithRetries(
      `${DID_API.url}/${DID_API.service}/streams`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${DID_API.key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(presenterInputByService[DID_API.service]),
      }
    );

    const {
      id: newStreamId,
      offer,
      ice_servers: iceServers,
      session_id: newSessionId,
    } = await sessionResponse.json();
    setStreamId(newStreamId);
    setSessionId(newSessionId);

    try {
      sessionClientAnswer = await createPeerConnection(offer, iceServers);
    } catch (e) {
      console.log("error during streaming setup", e);
      stopAllStreams();
      closePC();
      return;
    }

    const sdpResponse = await fetch(
      `${DID_API.url}/${DID_API.service}/streams/${streamId}/sdp`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${DID_API.key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          answer: sessionClientAnswer,
          session_id: sessionId,
        }),
      }
    );
    // Implement connect functionality
  };

  const handleStart = async () => {
    // Implement start functionality
    if (
      peerConnection?.signalingState === "stable" ||
      peerConnection?.iceConnectionState === "connected"
    ) {
      const playResponse = await fetchWithRetries(
        `${DID_API.url}/${DID_API.service}/streams/${streamId}`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${DID_API.key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            script: {
              type: "audio",
              audio_url:
                "https://d-id-public-bucket.s3.us-west-2.amazonaws.com/webrtc.mp3",
            },
            ...(DID_API.service === "clips" && {
              background: {
                color: "#FFFFFF",
              },
            }),
            config: {
              stitch: true,
            },
            session_id: sessionId,
          }),
        }
      );
    }
  };

  const handleDestroy = async () => {
    // Implement destroy functionality
    await fetch(`${DID_API.url}/${DID_API.service}/streams/${streamId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Basic ${DID_API.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ session_id: sessionId }),
    });

    stopAllStreams();
    closePC();
  };

  function onIceGatheringStateChange() {
    iceGatheringStatusLabel.innerText = peerConnection.iceGatheringState;
    iceGatheringStatusLabel.className =
      "iceGatheringState-" + peerConnection.iceGatheringState;
  }
  function onIceCandidate(event) {
    console.log("onIceCandidate", event);
    if (event.candidate) {
      const { candidate, sdpMid, sdpMLineIndex } = event.candidate;

      fetch(`${DID_API.url}/${DID_API.service}/streams/${streamId}/ice`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${DID_API.key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          candidate,
          sdpMid,
          sdpMLineIndex,
          session_id: sessionId,
        }),
      });
    }
  }
  function onIceConnectionStateChange() {
    iceStatusLabel.innerText = peerConnection.iceConnectionState;
    iceStatusLabel.className =
      "iceConnectionState-" + peerConnection.iceConnectionState;
    if (
      peerConnection.iceConnectionState === "failed" ||
      peerConnection.iceConnectionState === "closed"
    ) {
      stopAllStreams();
      closePC();
    }
  }
  function onConnectionStateChange() {
    // not supported in firefox
    peerStatusLabel.innerText = peerConnection.connectionState;
    peerStatusLabel.className =
      "peerConnectionState-" + peerConnection.connectionState;
  }
  function onSignalingStateChange() {
    signalingStatusLabel.innerText = peerConnection.signalingState;
    signalingStatusLabel.className =
      "signalingState-" + peerConnection.signalingState;
  }

  function onVideoStatusChange(videoIsPlaying, stream) {
    let status;
    if (videoIsPlaying) {
      status = "streaming";
      const remoteStream = stream;
      setVideoElement(remoteStream);
    } else {
      status = "empty";
      playIdleVideo();
    }
    streamingStatusLabel.innerText = status;
    streamingStatusLabel.className = "streamingState-" + status;
  }
  function onTrack(event) {
    if (!event.track) return;

    setStatsIntervalId(
      setInterval(async () => {
        const stats = await peerConnection.getStats(event.track);
        stats.forEach((report) => {
          if (report.type === "inbound-rtp" && report.mediaType === "video") {
            const videoStatusChanged =
              videoIsPlaying !== report.bytesReceived > lastBytesReceived;

            if (videoStatusChanged) {
              setVideoIsPlaying(report.bytesReceived > lastBytesReceived);
              onVideoStatusChange(videoIsPlaying, event.streams[0]);
            }
            setLastBytesReceived(report.bytesReceived);
          }
        });
      }, 500)
    );
  }

  async function createPeerConnection(offer, iceServers) {
    if (!peerConnection) {
      setPeerConnection(new RTCPeerConnection({ iceServers }));
      peerConnection.addEventListener(
        "icegatheringstatechange",
        onIceGatheringStateChange,
        true
      );
      peerConnection.addEventListener("icecandidate", onIceCandidate, true);
      peerConnection.addEventListener(
        "iceconnectionstatechange",
        onIceConnectionStateChange,
        true
      );
      peerConnection.addEventListener(
        "connectionstatechange",
        onConnectionStateChange,
        true
      );
      peerConnection.addEventListener(
        "signalingstatechange",
        onSignalingStateChange,
        true
      );
      peerConnection.addEventListener("track", onTrack, true);
    }

    await peerConnection.setRemoteDescription(offer);
    console.log("set remote sdp OK");

    const sessionClientAnswer = await peerConnection.createAnswer();
    console.log("create local sdp OK");

    await peerConnection.setLocalDescription(sessionClientAnswer);
    console.log("set local sdp OK");

    return sessionClientAnswer;
  }

  function setVideoElement(stream) {
    if (!stream) return;
    videoElement.srcObject = stream;
    videoElement.loop = false;

    // safari hotfix
    if (videoElement.paused) {
      videoElement
        .play()
        .then((_) => {})
        .catch((e) => {});
    }
  }

  function playIdleVideo() {
    videoElement.srcObject = undefined;
    videoElement.src =
      DID_API.service == "clips" ? "rian_idle.mp4" : "or_idle.mp4";
    videoElement.loop = true;
  }

  function stopAllStreams() {
    if (videoElement.srcObject) {
      console.log("stopping video streams");
      videoElement.srcObject.getTracks().forEach((track) => track.stop());
      videoElement.srcObject = null;
    }
  }

  function closePC(pc = peerConnection) {
    if (!pc) return;
    console.log("stopping peer connection");
    pc.close();
    pc.removeEventListener(
      "icegatheringstatechange",
      onIceGatheringStateChange,
      true
    );
    pc.removeEventListener("icecandidate", onIceCandidate, true);
    pc.removeEventListener(
      "iceconnectionstatechange",
      onIceConnectionStateChange,
      true
    );
    pc.removeEventListener(
      "connectionstatechange",
      onConnectionStateChange,
      true
    );
    pc.removeEventListener(
      "signalingstatechange",
      onSignalingStateChange,
      true
    );
    pc.removeEventListener("track", onTrack, true);
    clearInterval(statsIntervalId);
    iceGatheringStatusLabel.innerText = "";
    signalingStatusLabel.innerText = "";
    iceStatusLabel.innerText = "";
    peerStatusLabel.innerText = "";
    console.log("stopped peer connection");
    if (pc === peerConnection) {
      setPeerConnection(null);
    }
  }

  const maxRetryCount = 3;
  const maxDelaySec = 4;

  async function fetchWithRetries(url, options, retries = 1) {
    try {
      return await fetch(url, options);
    } catch (err) {
      if (retries <= maxRetryCount) {
        const delay =
          Math.min(Math.pow(2, retries) / 4 + Math.random(), maxDelaySec) *
          1000;

        await new Promise((resolve) => setTimeout(resolve, delay));

        console.log(
          `Request failed, retrying ${retries}/${maxRetryCount}. Error ${err}`
        );
        return fetchWithRetries(url, options, retries + 1);
      } else {
        throw new Error(`Max retries exceeded. error: ${err}`);
      }
    }
  }

  return (
    <div id="content">
      <div id="video-wrapper">
        <div>
          <video id="video-element" width="400" height="400" autoPlay></video>
        </div>
      </div>

      <div id="buttons">
        <button id="connect-button" type="button" onClick={handleConnect}>
          Connect
        </button>
        <button id="start-button" type="button" onClick={handleStart}>
          Start
        </button>
        <button id="destroy-button" type="button" onClick={handleDestroy}>
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
      <script type="module" src="./index.js"></script>
    </div>
  );
}

export default App;
