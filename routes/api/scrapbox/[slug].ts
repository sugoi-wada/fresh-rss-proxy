import { parseFeed } from "@mikaelporttila/rss";
import { define } from "../../../utils.ts";
import { Feed as NewFeed } from "feed";

export const handler = define.handlers({
  async GET(ctx) {
    const { slug } = ctx.params;

    const project = await fetchScrapboxPages(slug);
    const feedFrom = await parseScrapboxFeed(slug);

    const feedTo = new NewFeed({
      id: feedFrom.id,
      title: feedFrom.title.value ?? "Untitled - Scrapbox",
      link: feedFrom.links[0],
      description: feedFrom.description,
      docs: feedFrom.docs,
      updated: feedFrom.updateDate,
      copyright: feedFrom.copyright ?? "",
      generator: "fresh-rss-proxy",
    });

    feedFrom.entries.forEach((entry) => {
      const simpleTitle =
        entry.title?.value?.replace(
          new RegExp(` - ${slug} - Scrapbox$`, "g"),
          ""
        ) ?? "Untitled";
      const page = project.pages.find((p) => p.title === simpleTitle);

      feedTo.addItem({
        id: entry.id,
        title: simpleTitle,
        link: entry.links[0].href ?? "",
        description: entry.description?.value,
        date: entry["dc:created"] ?? new Date(),
        published: page ? new Date(page.created * 1000) : entry.published,
      });
    });

    return new Response(feedTo.rss2(), {
      headers: {
        "Content-Type": "application/xml",
        "Cache-Control": "s-maxage=60, stale-while-revalidate",
      },
    });
  },
});

const fetchScrapboxPages = async (
  slug: string
): Promise<{
  pages: {
    title: string;
    created: number;
    updated: number;
  }[];
}> => {
  const resp = await fetch(`https://scrapbox.io/api/pages/${slug}`);

  if (resp.status > 299) {
    throw Error(`Page ${resp.url} returns ${resp.status} ${resp.body}`);
  }
  return await resp.json();
};

const parseScrapboxFeed = async (slug: string) => {
  const resp = await fetch(`https://scrapbox.io/api/feed/${slug}`);

  if (resp.status > 299) {
    throw Error(`Page ${resp.url} returns ${resp.status} ${resp.body}`);
  }
  const xml = await resp.text();
  return await parseFeed(xml);
};
