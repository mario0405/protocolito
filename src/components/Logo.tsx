import React from "react";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "./ui/dialog";
import { VisuallyHidden } from "./ui/visually-hidden";
import { About } from "./About";
import { APP_NAME } from "@/constants/branding";

interface LogoProps {
    isCollapsed: boolean;
}

const Logo = React.forwardRef<HTMLButtonElement, LogoProps>(({ isCollapsed }, ref) => {
  return (
    <Dialog aria-describedby={undefined}>
      {isCollapsed ? (
        <DialogTrigger asChild>
          <button
            ref={ref}
            aria-label={`About ${APP_NAME}`}
            className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-stone-950 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-85"
          >
            P
          </button>
        </DialogTrigger>
      ) : (
        <DialogTrigger asChild>
          <span className="text-lg text-left font-semibold tracking-normal text-stone-950 mb-2 block items-center cursor-pointer hover:opacity-80 transition-opacity">
            <span>{APP_NAME}</span>
          </span>
        </DialogTrigger>
      )}
      <DialogContent>
        <VisuallyHidden>
          <DialogTitle>About {APP_NAME}</DialogTitle>
        </VisuallyHidden>
        <About />
      </DialogContent>
    </Dialog>
  );
});

Logo.displayName = "Logo";

export default Logo;
