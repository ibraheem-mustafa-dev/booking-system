# Embedding the Booking Widget

The booking system can be embedded as an iframe on your WordPress site (or any external site).

> **Staging vs Production**
> The current live URL is `book.smallgiantsstudio.cloud` (staging). The production URL `book.smallgiantsstudio.co.uk` will be used once the custom domain is configured. Replace the domain in the snippets below when you switch.

## Quick Start

Paste this into a WordPress Custom HTML block, page builder, or theme template:

```html
<iframe
  src="https://book.smallgiantsstudio.cloud/45-minute-strategy-session"
  width="100%"
  height="700"
  frameborder="0"
  style="border: none; border-radius: 8px;"
  allow="payment"
  loading="lazy"
  title="Book a strategy session"
></iframe>
```

Replace `/45-minute-strategy-session` with the slug of the booking type you want to embed (e.g. `/discovery-call`, `/therapy-session`).

### Finding your booking type slug

1. Log in to the dashboard at `https://book.smallgiantsstudio.cloud/dashboard`
2. Go to **Booking Types**
3. Click the booking type you want to embed
4. The slug is shown in the URL — e.g. if the URL ends in `/45-minute-strategy-session`, your slug is `45-minute-strategy-session`

## Responsive Wrapper

For a responsive embed that fills its container:

```html
<div style="width: 100%; max-width: 480px; margin: 0 auto;">
  <iframe
    src="https://book.smallgiantsstudio.cloud/45-minute-strategy-session"
    width="100%"
    height="700"
    frameborder="0"
    style="border: none; border-radius: 8px;"
    allow="payment"
    loading="lazy"
    title="Book a strategy session"
  ></iframe>
</div>
```

## WordPress Shortcode (Optional)

If you want a reusable shortcode, add this to your theme's `functions.php`:

```php
function sgs_booking_iframe( $atts ) {
    $atts = shortcode_atts( [
        'type'   => '45-minute-strategy-session',
        'height' => '700',
    ], $atts );

    $url = 'https://book.smallgiantsstudio.cloud/' . esc_attr( $atts['type'] );

    return sprintf(
        '<iframe src="%s" width="100%%" height="%s" frameborder="0" style="border: none; border-radius: 8px;" allow="payment" loading="lazy" title="Book an appointment"></iframe>',
        esc_url( $url ),
        intval( $atts['height'] )
    );
}
add_shortcode( 'booking', 'sgs_booking_iframe' );
```

Usage: `[booking type="45-minute-strategy-session" height="700"]`

## URL Format

| URL | Description |
|-----|-------------|
| `https://book.smallgiantsstudio.cloud/45-minute-strategy-session` | Short URL (recommended) |
| `https://book.smallgiantsstudio.cloud/book/small-giants/45-minute-strategy-session` | Legacy URL (redirects to short URL) |

## Allowed Embed Domains

The booking system only allows iframe embedding from:

- `https://smallgiantsstudio.co.uk`
- `https://*.smallgiantsstudio.co.uk`
- `https://*.smallgiantsstudio.cloud`

If you need to embed on a different domain, update the `Content-Security-Policy` `frame-ancestors` directive in `next.config.ts`.

## Auto-Height (Optional Enhancement)

To automatically resize the iframe to match its content height, add this script to the page containing the iframe:

```html
<script>
  window.addEventListener('message', function (event) {
    if (event.origin !== 'https://book.smallgiantsstudio.cloud') return;
    if (event.data && event.data.type === 'booking-resize') {
      var iframe = document.querySelector('iframe[src*="book.smallgiantsstudio.cloud"]');
      if (iframe) iframe.style.height = event.data.height + 'px';
    }
  });
</script>
```

This listens for `postMessage` events from the booking widget and adjusts the iframe height automatically. The booking app will send these messages as the user moves through steps.

**Recommended heights without auto-resize:**
- Desktop: 700px covers most booking flows
- Mobile-first layouts: 900px to avoid scrolling within the iframe

## Troubleshooting

**Iframe shows blank or "refused to connect":**
Check the browser console for `frame-ancestors` errors. The embedding domain must be in the allowed list above.

**Iframe is too short / content is cut off:**
Increase the `height` attribute. The booking flow typically needs 600-800px depending on the number of custom fields.

**Booking flow looks unstyled:**
The widget uses the organisation's branding (colours, fonts) set in the dashboard. Check Dashboard > Settings > Branding.
