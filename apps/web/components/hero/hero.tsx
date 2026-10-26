import { getTranslations } from "next-intl/server";
import { ArrowDown } from "@phosphor-icons/react/dist/ssr";
import { BrandRace } from "./brand-race";
import { HeroProvider } from "./hero-state";
import { HeroSource, RegistrationSummary } from "./registration-summary";
import { VehicleBlueprint } from "./vehicle-blueprint";
import { Plate } from "../ui/plate";

/**
 * Split hero. Left, on paper: the statement, the engineering drawing as the
 * page's one orchestrated moment, and the selected month as a composed figure.
 * Right, on graphite: the brand ranking with its timeline. Both sides follow
 * one selected month and vehicle type (HeroProvider).
 */
export async function Hero({ span, brandPages }: { span: [string, string]; brandPages: string[] }) {
  const t = await getTranslations("hero");

  return (
    <HeroProvider brandPages={brandPages}>
      <section aria-labelledby="hero-title" className="relative border-b border-rule">
        <div className="grid lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)]">
          {/* Editorial column */}
          <div className="relative flex flex-col px-4 pb-10 pt-7 sm:px-8 md:pt-9 lg:px-10 lg:pb-8 xl:px-14">
            <div className="enter-fade" style={{ ["--i" as string]: 0 }}>
              <Plate>{t("plate", { from: span[0], to: span[1] })}</Plate>
            </div>
            <h1
              id="hero-title"
              className="t-display enter-rise mt-4 text-[clamp(2.6rem,11.5vw,5.2rem)] text-ink lg:text-[clamp(3rem,4.4vw,5.9rem)]"
              style={{ ["--i" as string]: 1 }}
            >
              {(t.raw("headlineLines") as string[]).map((line, index) => (
                <span key={index} className="block whitespace-nowrap">
                  {line}{" "}
                </span>
              ))}
            </h1>
            <p
              className="enter-rise mt-4 max-w-[50ch] text-[16px] leading-[1.55] text-graphite md:text-[16.5px]"
              style={{ ["--i" as string]: 2 }}
            >
              {t("lede")}
            </p>

            {/* The drawing sits on a faint engineering grid that fades at the edges. */}
            <div className="relative -mx-2 mt-4 sm:mx-0 lg:mt-3">
              <div
                className="grid-light pointer-events-none absolute inset-0 [mask-image:radial-gradient(75%_80%_at_50%_55%,#000_35%,transparent_80%)]"
                aria-hidden="true"
              />
              <VehicleBlueprint className="relative mx-auto block h-auto w-full max-w-[520px] 2xl:max-w-[640px]" />
            </div>

            <div className="enter-rise mt-3 max-w-[600px]" style={{ ["--i" as string]: 3 }}>
              <RegistrationSummary />
            </div>

            <div className="enter-rise mt-5 flex flex-wrap items-center gap-x-6 gap-y-3" style={{ ["--i" as string]: 4 }}>
              <a
                href="#explorer"
                className="press group inline-flex h-[52px] items-center gap-3 rounded-full bg-ink pl-6 pr-2 text-[15px] font-medium text-paper transition-colors duration-200 hover:bg-graphite"
              >
                {t("cta")}
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-lime text-ink transition-transform duration-200 group-hover:translate-y-0.5">
                  <ArrowDown size={16} weight="bold" aria-hidden="true" />
                </span>
              </a>
              <a
                href="#methodology"
                className="text-[15px] font-medium text-ink underline decoration-rule-strong decoration-2 underline-offset-[6px] transition-colors duration-200 hover:decoration-ink"
              >
                {t("method")}
              </a>
              <HeroSource className="t-meta text-muted sm:ml-auto" />
            </div>
          </div>

          {/* Data column */}
          <div className="grid-dark relative overflow-hidden bg-ink px-4 pb-6 pt-8 text-paper sm:px-8 md:pt-9 lg:px-9 xl:px-12">
            <div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_70%_at_100%_0%,rgba(213,240,139,0.07),transparent_55%)]"
              aria-hidden="true"
            />
            <div className="enter-fade relative h-full" style={{ ["--i" as string]: 2 }}>
              <BrandRace />
            </div>
          </div>
        </div>
      </section>
    </HeroProvider>
  );
}
