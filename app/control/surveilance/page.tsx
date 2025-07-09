"use client";
import * as React from "react";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Video, CircleDot, Circle } from "lucide-react";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

const cameras = [
	{
		name: "Front Gate Camera",
		live: true,
		active: true,
		streamUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
	},
	{
		name: "Warehouse Camera",
		live: false,
		active: false,
		streamUrl: "",
	},
	{
		name: "Parking Lot Camera",
		live: true,
		active: true,
		streamUrl: "https://www.w3schools.com/html/movie.mp4",
	},
	{
		name: "Office Entrance Camera",
		live: true,
		active: false,
		streamUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
	},
];

export default function SurveillancePage() {
	const [selected, setSelected] = React.useState<number | null>(null);
	return (
		<SidebarInset>
			<header className="flex h-16 items-center justify-between border-b px-4 bg-gradient-to-r from-slate-50 to-slate-100">
				<div className="flex items-center gap-2">
					<SidebarTrigger />
					<Separator orientation="vertical" className="h-4" />
					<Video className="w-5 h-5" />
					<h1 className="text-lg font-semibold">Surveillance CCTV</h1>
				</div>
			</header>
			<main className="flex flex-col items-center min-h-[calc(100vh-80px)] bg-gradient-to-br from-slate-50 to-white p-6">
				<div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-5xl">
					{cameras.map((camera, idx) => (
						<Card key={idx} className="shadow-xl rounded-2xl border-0 transition-transform hover:scale-[1.02] hover:shadow-2xl relative">
							<CardHeader>
								<CardTitle className="flex items-center gap-2 text-base md:text-lg">
									{camera.name}
								</CardTitle>
								<CardDescription>
									Real-time surveillance feed from your IoT camera.
								</CardDescription>
								{/* Active/Inactive badge in top-right of card, always visible */}
								<div className="absolute top-4 right-4 z-20">
									{camera.active ? (
										<span className="flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs font-semibold shadow">
											<CircleDot className="w-3 h-3 text-green-500 animate-pulse" />
											Active
										</span>
									) : (
										<span className="flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 text-gray-500 text-xs font-semibold shadow">
											<Circle className="w-3 h-3 text-gray-400" />
											Inactive
										</span>
									)}
								</div>
							</CardHeader>
							<CardContent>
								<div className="relative aspect-video rounded-lg overflow-hidden border bg-black flex items-center justify-center">
									{/* Live/Offline badge in top-right of video */}
									<div className="absolute top-3 right-3 z-10 flex items-center gap-1">
										{camera.live ? (
											<span className="flex items-center gap-1 px-2 py-1 rounded-full bg-red-600/90 text-white text-xs font-bold shadow animate-pulse">
												<span className="w-2 h-2 rounded-full bg-white animate-ping mr-1" />
												LIVE
											</span>
										) : (
											<span className="flex items-center gap-1 px-2 py-1 rounded-full bg-gray-400/80 text-white text-xs font-bold">
												<span className="w-2 h-2 rounded-full bg-gray-200 mr-1" />
												OFFLINE
											</span>
										)}
									</div>
									{camera.live ? (
										<video src={camera.streamUrl} autoPlay muted controls className="w-full h-full object-cover" />
									) : (
										<div className="flex flex-col items-center justify-center w-full h-full gap-2">
											<Video className="w-12 h-12 text-gray-400 opacity-60" />
											<span className="text-gray-400 text-sm font-semibold">Camera offline</span>
										</div>
									)}
								</div>
							</CardContent>
							<CardFooter className="flex justify-between items-center w-full">
								<span className="text-xs text-muted-foreground font-mono">
									{new Date().toLocaleString()}
								</span>
								<Dialog open={selected === idx} onOpenChange={open => setSelected(open ? idx : null)}>
									<DialogTrigger asChild>
										<Button variant="outline" size="sm" type="button">
											View Details
										</Button>
									</DialogTrigger>
									<DialogContent>
										<DialogHeader>
											<DialogTitle className="flex items-center gap-2">
												<Video className="w-5 h-5 text-gray-700" /> CCTV Details
											</DialogTitle>
											<DialogDescription>
												<span className="text-base font-semibold text-gray-800">{camera.name}</span>
											</DialogDescription>
										</DialogHeader>
										<div className="grid grid-cols-1 gap-4 py-2">
											<div className="space-y-2 text-sm">
												<div><span className="font-semibold text-muted-foreground">ID:</span> <span className="font-mono">CAM-{idx + 1}</span></div>
												<div><span className="font-semibold text-muted-foreground">Merk:</span> Hikvision</div>
												<div><span className="font-semibold text-muted-foreground">RTSP:</span> <span className="break-all font-mono text-xs">rtsp://user:pass@192.168.1.{10 + idx}:554/stream</span></div>
												<div><span className="font-semibold text-muted-foreground">Status:</span> <span className={camera.live ? "text-green-600" : "text-gray-500"}>{camera.live ? "Live" : "Offline"}</span> / <span className={camera.active ? "text-green-600" : "text-gray-500"}>{camera.active ? "Active" : "Inactive"}</span></div>
												<div><span className="font-semibold text-muted-foreground">Last Update:</span> <span className="font-mono">{new Date().toLocaleString()}</span></div>
											</div>
										</div>
										<DialogFooter>
											<DialogTrigger asChild>
												<Button variant="secondary" type="button" onClick={() => setSelected(null)}>
													Close
												</Button>
											</DialogTrigger>
										</DialogFooter>
									</DialogContent>
								</Dialog>
							</CardFooter>
						</Card>
					))}
				</div>
			</main>
		</SidebarInset>
	);
}
