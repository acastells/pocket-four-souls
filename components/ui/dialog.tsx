import type { ComponentProps } from "react";
import { Dialog as Primitive } from "radix-ui";
import { X } from "lucide-react";
export const Dialog = Primitive.Root;
export function DialogTitle(props: ComponentProps<typeof Primitive.Title>) {
  return <Primitive.Title data-slot="dialog-title" {...props} />;
}
export function DialogDescription(
  props: ComponentProps<typeof Primitive.Description>,
) {
  return <Primitive.Description data-slot="dialog-description" {...props} />;
}
export function DialogContent({
  children,
  showCloseButton = true,
  ...props
}: ComponentProps<typeof Primitive.Content> & { showCloseButton?: boolean }) {
  return (
    <Primitive.Portal>
      <Primitive.Overlay data-slot="dialog-overlay" />
      <Primitive.Content {...props}>
        {children}
        {showCloseButton && (
          <Primitive.Close data-slot="dialog-close" aria-label="Cerrar">
            <X />
          </Primitive.Close>
        )}
      </Primitive.Content>
    </Primitive.Portal>
  );
}
