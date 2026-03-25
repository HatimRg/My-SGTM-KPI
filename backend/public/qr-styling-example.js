// Example: qr-code-styling library setup
// Include via CDN: https://unpkg.com/qr-code-styling@1.5.0/lib/qr-code-styling.js

const qrCode = new QRCodeStyling({
    width: 300,
    height: 300,
    type: "canvas", // or "svg"
    data: "http://102.54.244.33/api/public/sds/test/view",
    image: "/path/to/logo.png",
    margin: 10,
    qrOptions: {
        typeNumber: "0",
        mode: "Byte",
        errorCorrectionLevel: "Q"
    },
    imageOptions: {
        hideBackgroundDots: true,
        imageSize: 0.4,
        margin: 0
    },
    dotsOptions: {
        type: "rounded", // "dots", "rounded", "square", "classy", "classy-rounded"
        color: "#FB9D01",
        gradient: {
            type: "linear",
            rotation: 0,
            colorStops: [
                { offset: 0, color: "#FB9D01" },
                { offset: 1, color: "#FF6B35" }
            ]
        }
    },
    backgroundOptions: {
        color: "#ffffff",
        round: 0.1
    },
    cornersSquareOptions: {
        type: "extra-rounded", // "square", "rounded", "extra-rounded"
        color: "#FB9D01"
    },
    cornersDotOptions: {
        type: "dot", // "square", "rounded", "dot"
        color: "#FB9D01"
    }
});

// Add to DOM
qrCode.append(document.getElementById("qr-container"));

// Download options
qrCode.download({ name: "qr", extension: "png" });
qrCode.download({ name: "qr", extension: "svg" });
