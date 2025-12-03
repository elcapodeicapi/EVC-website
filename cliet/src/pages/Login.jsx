import React from "react";

// Minimal login placeholder to satisfy redirects from expired sessions.
// The full form can be restored later; this avoids build errors.
export default function Login() {
	return (
		<div className="mx-auto max-w-xl p-8">
			<h1 className="text-2xl font-semibold text-slate-900">Inloggen</h1>
			<p className="mt-2 text-slate-600">Je sessie is verlopen. Log opnieuw in via de startpagina of je gebruikelijke inlogroute.</p>
			<a href="/" className="mt-4 inline-block rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500">Ga naar startpagina</a>
		</div>
	);
}

// export default Login;

