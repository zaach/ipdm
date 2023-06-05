import { Link } from "./Link";
export function AboutDialog() {
  return (
    <>
      <input type="checkbox" id="about-modal" className="modal-toggle" />

      <label htmlFor="about-modal" className="modal cursor-pointer">
        <label className="modal-box relative" htmlFor="">
          <div className="relative h-12 flex place-content-center mb-4">
            <img src="/ipdm-logo.png" className="md:w-12 md:h-12" />
          </div>
          <div className="alert p-1 pl-2">
            <div>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                className="stroke-current flex-shrink-0 w-6 h-6"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="text-xs py-1">
                This app is demo-tier! Use{" "}
                <Link href="https://signal.org/">Signal</Link> if you need the
                real deal.
              </span>
            </div>
          </div>
          <div className="mt-4 text-sm">
            <p className="text-center">
              This is a work-in-progress decentralized secure messaging
              platform. For more information visit the source repository.
            </p>
            <p className="text-center mt-4 inline-flex items-center gap-2 w-full justify-center">
              <Link href="https://github.com/zaach/ipdm">
                Source{" "}
                <svg
                  id="i-github"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 64 64"
                  width="16"
                  height="16"
                  className="inline-block"
                >
                  <path
                    stroke-width="0"
                    fill="currentColor"
                    d="M32 0 C14 0 0 14 0 32 0 53 19 62 22 62 24 62 24 61 24 60 L24 55 C17 57 14 53 13 50 13 50 13 49 11 47 10 46 6 44 10 44 13 44 15 48 15 48 18 52 22 51 24 50 24 48 26 46 26 46 18 45 12 42 12 31 12 27 13 24 15 22 15 22 13 18 15 13 15 13 20 13 24 17 27 15 37 15 40 17 44 13 49 13 49 13 51 20 49 22 49 22 51 24 52 27 52 31 52 42 45 45 38 46 39 47 40 49 40 52 L40 60 C40 61 40 62 42 62 45 62 64 53 64 32 64 14 50 0 32 0 Z"
                  />
                </svg>
              </Link>
            </p>
          </div>
          <div className="modal-action justify-center">
            <label htmlFor="about-modal" className="btn btn-wide">
              okay
            </label>
          </div>
        </label>
      </label>
    </>
  );
}
