import React from "react";

const LegacyPageLayout = ({
	title,
	description,
	kicker,
	actions,
	children,
	showHeader = true,
	showNavbar = false,
}) => {
	return (
		<div className="min-h-screen bg-white">
			<main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-10 sm:px-6 lg:px-8">
				{showHeader && (title || description || kicker || actions) ? (
					<div className="flex flex-wrap items-start justify-between gap-6 border-b border-slate-200 pb-8">
						<div className="max-w-2xl space-y-2">
							{kicker ? (
								<p className="text-xs font-semibold uppercase tracking-[0.32em] text-brand-600">
									{kicker}
								</p>
							) : null}
							{title ? (
								<h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
									{title}
								</h1>
							) : null}
							{description ? (
								<p className="text-base text-slate-500 sm:text-lg">{description}</p>
							) : null}
						</div>
						{actions ? (
							<div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
								{actions}
							</div>
						) : null}
					</div>
				) : null}

				<div className={showHeader ? "mt-8 space-y-8" : "space-y-8"}>{children}</div>
			</main>
		</div>
	);
};

export default LegacyPageLayout;
