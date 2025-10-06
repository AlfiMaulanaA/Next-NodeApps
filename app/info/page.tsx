"use client";

import {
  SiNodedotjs,
  SiPython,
  SiTypescript,
  SiJavascript,
  SiNextdotjs,
  SiHtml5,
  SiTailwindcss,
  SiCss3,
} from "react-icons/si";

import {
  FileQuestion,
  Network,
  ServerCog,
  PlusCircle,
  BarChart2,
  AlertTriangle,
  RotateCw,
  SatelliteDish,
  GaugeCircle, // Import new icon for status
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";

export default function InfoFAQPage() {
  const techStack = [
    { name: "Node.js", icon: <SiNodedotjs size={32} className="text-green-600" /> },
    { name: "Python", icon: <SiPython size={32} className="text-blue-500" /> },
    { name: "Next.js", icon: <SiNextdotjs size={32} className="text-black dark:text-white" /> },
    { name: "HTML", icon: <SiHtml5 size={32} className="text-orange-500" /> },
    { name: "CSS", icon: <SiCss3 size={32} className="text-blue-600" /> },
    { name: "TypeScript", icon: <SiTypescript size={32} className="text-sky-600" /> },
    { name: "JavaScript", icon: <SiJavascript size={32} className="text-yellow-400" /> },
    { name: "Tailwind CSS", icon: <SiTailwindcss size={32} className="text-cyan-500" /> },
    { name: "MQTT", icon: <SatelliteDish size={32} className="text-red-600" /> },
    { name: "Networking", icon: <Network size={32} className="text-gray-500" /> },
  ];

  const faqs = [
    {
      icon: <Network className="w-5 h-5 text-blue-600 mt-1" />,
      question: "What communication protocols are supported?",
      answer: "The system supports Modbus RTU, Modbus TCP, SNMP, and MQTT protocols.",
    },
    {
      icon: <PlusCircle className="w-5 h-5 text-green-600 mt-1" />,
      question: "Can I add custom devices?",
      answer: "Yes, you can add, update, or delete custom devices using the Device Manager.",
    },
    {
      icon: <BarChart2 className="w-5 h-5 text-yellow-500 mt-1" />,
      question: "What types of data are monitored?",
      answer: "The system monitors key data points such as Voltage, Current, Power, Energy, and various device statuses.",
    },
    // New FAQ for device status
    {
      icon: <GaugeCircle className="w-5 h-5 text-purple-600 mt-1" />,
      question: "How does device status work?",
      answer: "A device's status will show as Online if it's actively receiving data from metering equipment and successfully connected to the controller. If there's no connection or no data being received, its status will be Offline.",
    },
    {
      icon: <AlertTriangle className="w-5 h-5 text-red-600 mt-1" />,
      question: "What should I do if data isn't showing?",
      answer: "First, check the device connections. Then, verify the MQTT broker status and ensure all port settings are configured correctly.",
    },
  ];

  return (
    <SidebarInset>
      {/* Header */}
      <header className="flex h-16 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="h-4" />
          <FileQuestion className="w-5 h-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">Information & FAQ</h1>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => window.location.reload()}
          title="Reload page"
          aria-label="Reload"
        >
          <RotateCw className="w-4 h-4" />
        </Button>
      </header>

      {/* Content */}
      <main className="px-20 sm:px-16 md:px-24 py-8 space-y-12 transition-all">
        {/* Info Section */}
        <section>
          <div className="flex items-center gap-2 mb-2">
            <ServerCog className="w-5 h-5 text-primary" />
            <h2 className="text-3xl font-bold">BMS Monitoring System</h2>
          </div>
          <p className="text-muted-foreground max-w-3xl leading-relaxed">
            This system enables real-time monitoring and control of Battery Management System (BMS) devices.
            It supports Modbus RTU/TCP, SNMP, and MQTT protocols, visualizing key data and statuses via a web interface.
          </p>
        </section>

        <Separator />

        {/* FAQ Section */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <FileQuestion className="w-5 h-5 text-primary" />
            <h2 className="text-2xl font-semibold">Frequently Asked Questions</h2>
          </div>
          <ul className="space-y-6 text-sm sm:text-base">
            {faqs.map((faq, index) => (
              <li
                key={index}
                className="flex gap-3 p-4 rounded-xl hover:bg-accent/40 transition duration-300 shadow-sm"
              >
                {faq.icon}
                <div className="transition-all">
                  <strong className="block mb-1">{faq.question}</strong>
                  <span className="text-muted-foreground">{faq.answer}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <Separator />

        {/* Tech Stack Section */}
        <section>
          <div className="flex items-center gap-2 mb-2">
            <ServerCog className="w-5 h-5 text-primary" />
            <h2 className="text-2xl font-semibold">Technology Stack</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-6">
            {techStack.map((tech) => (
              <div
                key={tech.name}
                className="group p-4 rounded-2xl shadow-md transition-transform duration-300 hover:scale-105 hover:bg-primary/10 cursor-pointer"
              >
                <div className="flex flex-col items-center space-y-2">
                  {tech.icon}
                  <span className="text-sm font-medium group-hover:text-foreground">
                    {tech.name}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </SidebarInset>
  );
}
