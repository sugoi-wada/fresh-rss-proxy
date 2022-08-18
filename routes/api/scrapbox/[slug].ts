import { HandlerContext, Handlers } from "$fresh/server.ts";
import Parser from "rss-parser";

type CustomFeed = { lastBuildDate: string };
type CustomItem = { description: string };

const parser = new Parser<CustomFeed, CustomItem>({
  customFields: {
    feed: ["lastBuildDate"],
    item: ["description"],
  },
});

export const handler: Handlers = {
  async GET(_req: Request, ctx: HandlerContext) {
    const { slug } = ctx.params;

    const project = await fetchScrapboxPages(slug);
    const feed = await parser.parseURL(`https://scrapbox.io/api/feed/${slug}`);

    return new Response(
      '<?xml version="1.0" encoding="utf-8"?>' +
        '<rss version="2.0">' +
        "<channel>" +
        `<title>${feed.title}</title>` +
        `<link>${feed.link}</link>` +
        `<description>${feed.description}</description>` +
        `<lastBuildDate>${feed.lastBuildDate}</lastBuildDate>` +
        `<docs>https://validator.w3.org/feed/docs/rss2.html</docs>` +
        `<generator>fresh-rss-proxy</generator>` +
        feed.items
          .map((item) => {
            const simpleTitle = item.title?.replace(
              new RegExp(` - ${slug} - Scrapbox$`, "g"),
              ""
            );
            const page = project.pages.find((p) => p.title === simpleTitle);

            return (
              "<item>" +
              `<title><![CDATA[${simpleTitle}]]></title>` +
              `<link>${item.link}</link>` +
              `<guid>${item.guid}</guid>` +
              `<pubDate>${
                page
                  ? new Date(page.created * 1000).toUTCString()
                  : item.pubDate
              }</pubDate>` +
              `<description><![CDATA[${item.description}]]></description>` +
              "</item>"
            );
          })
          .join("") +
        "</channel>" +
        "</rss>",
      {
        headers: {
          "Content-Type": "application/xml",
          "Cache-Control": "s-maxage=60, stale-while-revalidate",
        },
      }
    );
  },
};

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
