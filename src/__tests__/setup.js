// Canvas stub for jsdom — provides the subset of CanvasRenderingContext2D
// that makeStoneTexture() needs so wall.js can be imported without error.
class FakeCtx {
    fillStyle   = '';
    strokeStyle = '';
    lineWidth   = 1;
    getImageData(_x, _y, w, h) { return { data: new Uint8ClampedArray(w * h * 4) }; }
    putImageData()  {}
    fillRect()      {}
    beginPath()     {}
    moveTo()        {}
    lineTo()        {}
    stroke()        {}
}

const _origCreate = document.createElement.bind(document);
document.createElement = (tag, ...args) => {
    const el = _origCreate(tag, ...args);
    if (tag === 'canvas') el.getContext = () => new FakeCtx();
    return el;
};
