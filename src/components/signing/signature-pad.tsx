// Drawing area for the client's handwritten signature (mouse, finger or stylus), built on react-signature-canvas.

"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";
import SignatureCanvas from "react-signature-canvas";

export type SignaturePadHandle = { isEmpty: () => boolean; clear: () => void; toPng: () => string };

export const SignaturePad = forwardRef<SignaturePadHandle, { onChange: (hasSignature: boolean) => void }>(
  function SignaturePad({ onChange }, ref) {
    const canvas = useRef<SignatureCanvas>(null);

    useImperativeHandle(ref, () => ({
      isEmpty: () => canvas.current?.isEmpty() ?? true,
      clear: () => {
        canvas.current?.clear();
        onChange(false);
      },
      // Trimmed to the drawn area so the PDF shows the signature at a sensible size.
      toPng: () => canvas.current!.getTrimmedCanvas().toDataURL("image/png"),
    }));

    return (
      <div className="relative rounded-md border-2 border-dashed border-stone-300 bg-white">
        <SignatureCanvas
          ref={canvas}
          penColor="#111827"
          onEnd={() => onChange(!(canvas.current?.isEmpty() ?? true))}
          canvasProps={{
            className: "block h-48 w-full touch-none",
            "aria-label": "Signature area. Draw your signature here.",
            // @ts-expect-error data attributes are valid on canvas
            "data-testid": "signature-canvas",
          }}
        />
        <span className="pointer-events-none absolute bottom-2 left-3 text-xs text-stone-400">Draw your signature here</span>
      </div>
    );
  },
);
