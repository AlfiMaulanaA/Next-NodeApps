"use client"

import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Refresh() {
    return (
        <>
        <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={() => window.location.reload()}
        title="Refresh halaman"
      >
        <RotateCw className="h-4 w-4" />
      </Button>
        </>
    )
}