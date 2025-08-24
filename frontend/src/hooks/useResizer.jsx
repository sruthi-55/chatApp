import { useState, useRef } from "react";

//# resizer b/w chatListSection and chatWindow
export default function useResizer(initialWidth, minWidth = 250, offset = 0) {
  const [width, setWidth] = useState(initialWidth);
  const isResizing = useRef(false);

  const startResizing = () => {
    isResizing.current = true;
  };

  const stopResizing = () => {
    isResizing.current = false;
  };

  const resize = (e) => {
    if (isResizing.current) {
      setWidth(Math.max(minWidth, e.clientX - offset));
    }
  };

  return { width, startResizing, stopResizing, resize };
}
