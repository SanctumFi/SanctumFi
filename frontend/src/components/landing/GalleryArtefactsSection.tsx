import { useRef, useEffect, useCallback } from "react";

const VIDEO_URL =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260308_114720_3dabeb9e-2c39-4907-b747-bc3544e2d5b7.mp4";

const LOGOS = ["LUNA", "AURA", "VESTA", "CHRONOS", "AEGIS"];

export function GalleryArtefactsSection() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const rafRef = useRef<number>(0);

  const updateOpacity = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.duration) {
      rafRef.current = requestAnimationFrame(updateOpacity);
      return;
    }

    const { currentTime, duration } = video;
    const fadeWindow = 0.5;
    let opacity = 1;

    if (currentTime < fadeWindow) {
      opacity = currentTime / fadeWindow;
    } else if (currentTime > duration - fadeWindow) {
      opacity = (duration - currentTime) / fadeWindow;
    }

    video.style.opacity = String(Math.max(0, Math.min(1, opacity)));
    rafRef.current = requestAnimationFrame(updateOpacity);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleEnded = () => {
      video.style.opacity = "0";
      setTimeout(() => {
        video.currentTime = 0;
        video.play();
      }, 100);
    };

    video.addEventListener("ended", handleEnded);
    rafRef.current = requestAnimationFrame(updateOpacity);

    return () => {
      video.removeEventListener("ended", handleEnded);
      cancelAnimationFrame(rafRef.current);
    };
  }, [updateOpacity]);

  return (
    <section className="relative w-full overflow-hidden">
      {/* Background video */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
        style={{ opacity: 0 }}
      >
        <source src={VIDEO_URL} type="video/mp4" />
      </video>

      {/* Gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-white/40 to-background" />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center pt-32 pb-32 px-4 gap-24">
        {/* Spacer for video visibility */}
        <div className="h-64" />

        {/* Logo Marquee */}
        <div className="max-w-5xl w-full flex items-center gap-12">
          {/* Left text */}
          <p className="text-foreground/50 text-sm tracking-widest uppercase whitespace-nowrap shrink-0">
            Securing assets for
            <br />
            global institutions
          </p>

          {/* Marquee */}
          <div className="overflow-hidden flex-1">
            <div className="flex gap-12 animate-marquee">
              {/* Duplicate logos for seamless loop */}
              {[...LOGOS, ...LOGOS].map((name, i) => (
                <div
                  key={`${name}-${i}`}
                  className="silk-veil px-8 py-4 shrink-0"
                >
                  <span className="font-display text-xl tracking-widest text-foreground">
                    {name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
