/**
 * Browser PBX Engine using PeerJS
 */
class BrowserPBX {
  constructor() {
    this.peer = null;
    this.currentExtension = null;
    this.onIncomingCallHandler = null;
  }

  // Register an extension ID on the network
  register(extensionNumber, onReady) {
    this.currentExtension = extensionNumber;
    
    // Create a peer connection using the extension number as the ID
    this.peer = new Peer(`pbx-ext-${extensionNumber}`);

    this.peer.on('open', (id) => {
      if (onReady) onReady(id);
    });

    // Listen for incoming calls
    this.peer.on('call', (mediaConnection) => {
      if (this.onIncomingCallHandler) {
        this.onIncomingCallHandler(mediaConnection);
      }
    });

    this.peer.on('error', (err) => {
      console.error('PBX Peer Error:', err);
      alert(`PBX Error: ${err.type}. Extension might already be in use.`);
    });
  }

  // Set callback for incoming calls
  onIncomingCall(handler) {
    this.onIncomingCallHandler = handler;
  }
}
