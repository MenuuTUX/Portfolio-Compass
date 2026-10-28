interface AsciiBackgroundProps {
  className?: string;
  color?: string;
  opacity?: number;
}

/**
 * Retired decoration. Export kept so existing imports do not break;
 * it renders nothing.
 */
export default function AsciiBackground(_props: AsciiBackgroundProps) {
  void _props;
  return null;
}
