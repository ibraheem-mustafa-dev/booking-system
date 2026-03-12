import Link from 'next/link';

export default function InvoicePaidPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md rounded-xl border bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-green-100">
          <svg
            className="size-8 text-green-600"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4.5 12.75l6 6 9-13.5"
            />
          </svg>
        </div>

        <h1 className="text-xl font-bold text-gray-900">Payment Received</h1>
        <p className="mt-2 text-sm text-gray-500">
          Thank you! Your payment has been processed successfully. A receipt
          will be sent to your email address.
        </p>

        <Link
          href="/"
          className="mt-6 inline-flex h-10 items-center justify-center rounded-lg bg-gray-900 px-6 text-sm font-medium text-white transition-colors hover:bg-gray-800"
        >
          Return home
        </Link>
      </div>
    </div>
  );
}
