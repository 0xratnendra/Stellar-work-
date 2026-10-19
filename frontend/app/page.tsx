import Link from "next/link";
import HomeFeed from "@/components/home/HomeFeed";

export default function HomePage() {
  return (
    <section className="space-y-6">
      <header className="rounded-lg border border-slate-200 bg-white p-6 md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex-1">
            <h1 className="text-2xl font-semibold text-slate-900 md:text-3xl">
              Find Your Next Opportunity
            </h1>
            <p className="mt-2 text-sm text-slate-600 md:text-base">
              Browse open jobs or post your own project on the decentralized Stellar marketplace.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/post-job"
              className="rounded-md bg-blue-600 px-5 py-2.5 text-center text-sm font-medium text-white transition-colors hover:bg-blue-700 active:bg-blue-800"
            >
              Post a Job
            </Link>
            <a
              href="#open-jobs"
              className="rounded-md border border-slate-300 bg-white px-5 py-2.5 text-center text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              Browse Jobs
            </a>
          </div>
        </div>
      </header>
      <HomeFeed />
    </section>
  );
}
