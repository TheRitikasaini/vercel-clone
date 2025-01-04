"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import io from "socket.io-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Github } from "lucide-react";
import { Fira_Code } from "next/font/google";
import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000";
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:9002";

const socket = io(SOCKET_URL);

const firaCode = Fira_Code({ subsets: ["latin"] });

export default function Home() {
  const [repoURL, setURL] = useState<string>("");
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [projectId, setProjectId] = useState<string | undefined>();
  const [deployPreviewURL, setDeployPreviewURL] = useState<string | null>(null);
  const logContainerRef = useRef<HTMLElement>(null);

  const isValidURL: [boolean, string | null] = useMemo(() => {
    if (!repoURL || repoURL.trim() === "") return [false, null];
    const regex = new RegExp(
      /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^\/]+)\/([^\/]+)(?:\/)?$/
    );
    return [regex.test(repoURL), "Enter valid Github Repository URL"];
  }, [repoURL]);

  const handleClickDeploy = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.post(`${API_URL}/project`, {
        gitURL: repoURL,
        slug: projectId,
      });

      if (data && data.data) {
        const { projectSlug, url } = data.data;
        setProjectId(projectSlug);
        setDeployPreviewURL(url);

        console.log(`Subscribing to logs:${projectSlug}`);
        socket.emit("subscribe", `logs:${projectSlug}`);
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error("Axios Error:", error.response?.data || error.message);
      } else {
        console.error("Unexpected Error:", error);
      }
    } finally {
      setLoading(false);
    }
  }, [projectId, repoURL]);

  const handleSocketIncommingMessage = useCallback((message: string) => {
    console.log(`[Incomming Socket Message]:`, typeof message, message);
    try {
      const { log } = JSON.parse(message);
      setLogs((prev) => [...prev.slice(-99), log]); // Limit to last 100 logs
      if (logContainerRef.current) {
        logContainerRef.current.scrollIntoView({ behavior: "smooth" });
      }
    } catch (error) {
      console.error("Error parsing socket message:", error);
    }
  }, []);

  useEffect(() => {
    socket.on("message", handleSocketIncommingMessage);
    socket.on("connect_error", (error: Error) =>
      console.error("Socket connection error:", error)
    );
    socket.on("disconnect", () => console.warn("Socket disconnected"));

    return () => {
      socket.off("message", handleSocketIncommingMessage);
      socket.off("connect_error");
      socket.off("disconnect");
    };
  }, [handleSocketIncommingMessage]);

  return (
    <main className="flex justify-center items-center h-[100vh]">
      <div className="w-[600px]">
        <span className="flex justify-start items-center gap-2">
          <Github className="text-5xl" />
          <Input
            disabled={loading}
            value={repoURL}
            onChange={(e) => setURL(e.target.value)}
            type="url"
            placeholder="Github URL"
          />
        </span>
        <Button
          onClick={handleClickDeploy}
          disabled={!isValidURL[0] || loading}
          className="w-full mt-3"
        >
          {loading ? "In Progress" : "Deploy"}
        </Button>
        {deployPreviewURL && (
          <div className="mt-2 bg-slate-900 py-4 px-2 rounded-lg">
            <p>
              Preview URL{" "}
              <a
                target="_blank"
                className="text-sky-400 bg-sky-950 px-3 py-2 rounded-lg"
                href={deployPreviewURL}
              >
                {deployPreviewURL}
              </a>
            </p>
          </div>
        )}
        {logs.length > 0 && (
          <div
            className={`${firaCode.className} text-sm text-green-500 logs-container mt-5 border-green-500 border-2 rounded-lg p-4 h-[300px] overflow-y-auto`}
          >
            <pre className="flex flex-col gap-1">
              {logs.map((log, i) => (
                <code
                  ref={logs.length - 1 === i ? logContainerRef : undefined}
                  key={i}
                >{`> ${log}`}</code>
              ))}
            </pre>
          </div>
        )}
      </div>
    </main>
  );
}
