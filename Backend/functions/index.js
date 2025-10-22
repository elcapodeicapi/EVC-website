/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const {onRequest} = require("firebase-functions/v2/https");
const {onInit} = require("firebase-functions/v2/core");

const createApp = require("./app");

// Global options moved per-function to avoid requiring the heavy v2 root module.

let appInstance;

onInit(() => {
	// Intentionally keep cold-start work minimal; app is created lazily on first request
});

exports.app = onRequest({ region: "europe-west1", maxInstances: 10, memory: "512MiB" }, (req, res) => {
	if (req.url.startsWith("/api/")) {
		req.url = req.url.replace(/^\/api/, "");
	} else if (req.url === "/api") {
		req.url = "/";
	}
	if (!appInstance) appInstance = createApp();
	return appInstance(req, res);
});
