from datetime import datetime, timedelta
import urllib2
import re
import email
import time
import random
import traceback
import logging
from icalendar import Calendar, Event
from icalendar.prop import vDatetime, vDate, vText

from molly.external_media import sanitise_html
from molly.conf.settings import batch

from molly.apps.feeds.providers import BaseFeedsProvider

__all__ = ['ICalFeedsProvider']

logger = logging.getLogger(__name__)


class ICalFeedsProvider(BaseFeedsProvider):
    """
    This is a basic iCal feeds provider.
    Tested with Google Calendar feeds.
    Doesn't react well with non standard iCal feeds.
    """
    verbose_name = 'iCal'

    @batch('%d * * * *' % random.randint(0, 59))
    def import_data(self, metadata, output):
        """
        Pulls iCal feeds
        """

        from molly.apps.feeds.models import Feed
        for feed in Feed.objects.filter(provider=self.class_path):
            output.write("Importing %s\n" % feed.title)
            try:
                self.import_feed(feed)
            except Exception, e:
                output.write("Error importing %s\n" % feed.title)
                traceback.print_exc(file=output)
                output.write('\n')
                logger.warn("Error importing feed %r" % feed.title,
                            exc_info=True, extra={'url': feed.rss_url})

        return metadata

    def import_feed(self, feed):
        from molly.apps.feeds.models import Item, vCard
        
        calendar = Calendar.from_string(urllib2.urlopen(feed.rss_url).read())

        items = set()
        for component in calendar.walk():

            if component.name == 'VEVENT':
                item, created = Item.objects.get_or_create(feed=feed, guid=str(component.get('UID')))
                # Do not create the event if one the property is not correct,
                # first tries to parse DT as datetime then as date, if it still fails, then ignore
                try:
                    try:
                        item.dt_start = vDatetime.from_ical(str(component.get('DTSTART')))
                    except ValueError, ve:
                        item.dt_start = vDate.from_ical(str(component.get('DTSTART')))
                    
                    if component.get('DTEND'):
                        try:
                            item.dt_end = vDatetime.from_ical(str(component.get('DTEND')))
                        except ValueError, ve:
                            item.dt_end = vDate.from_ical(str(component.get('DTEND')))
                    
                    item.title = vText.from_ical(str(component.get('SUMMARY')).strip())
                    
                    if component.get('URL'):
                        item.link = str(component.get('URL'))
                    
                    if component.get('DESCRIPTION'):
                        item.description = sanitise_html(vText.from_ical(str(component.get('DESCRIPTION'))))
                    
                    if str(component.get('LOCATION')) != '':
                        location, created = vCard.objects.get_or_create(name=str(component.get('LOCATION')).strip())
                        # in the future, we could imagine to (try to) geocode the location
                        # to get a point field...
                        location.save()
                        item.venue = location
                    
                    try:
                        item.last_modified = vDatetime.from_ical(str(component.get('LAST-MODIFIED')))
                    except Exception, e:
                        item.last_modified = datetime.now()
                    
                    item.save()
                    items.add(item)
                except ValueError, v:
                    logger.error('Could not parse event %s' % v)

        for item in Item.objects.filter(feed=feed):
            if item not in items:
                item.delete()

        return items