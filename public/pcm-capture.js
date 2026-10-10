/* PCM16, mono, 100 ms frames. AudioContext requests the model's 16 kHz input rate. */
class PcmCapture extends AudioWorkletProcessor {
  constructor() { super(); this.samples = []; }
  process(inputs) {
    const input = inputs[0]?.[0];
    if (input) for (const sample of input) this.samples.push(sample);
    const frameSize = Math.round(sampleRate / 10);
    while (this.samples.length >= frameSize) {
      const frame = this.samples.splice(0, frameSize);
      const buffer = new ArrayBuffer(frameSize * 2);
      const view = new DataView(buffer);
      for (let i = 0; i < frameSize; i++) {
        const s = Math.max(-1, Math.min(1, frame[i]));
        view.setInt16(i * 2, Math.round(s < 0 ? s * 32768 : s * 32767), true);
      }
      this.port.postMessage(buffer, [buffer]);
    }
    return true;
  }
}
registerProcessor('pcm-capture', PcmCapture);
