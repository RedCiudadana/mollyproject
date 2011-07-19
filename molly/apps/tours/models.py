from django.db import models
from django.core.urlresolvers import reverse

from molly.apps.places.models import Entity

class Tour(models.Model):
    
    stops = models.ManyToManyField(Entity, through='StopOnTour')
    
    def get_absolute_url(self):
        return reverse('tours:tour-start', args=[self.id])

class StopOnTour(models.Model):
    
    tour = models.ForeignKey(Tour)
    entity = models.ForeignKey(Entity)
    order = models.IntegerField()
    
    class Meta:
        ordering = ['order']
    
    def get_absolute_url(self):
        return reverse('tours:tour', args=[self.tour.id, self.order])

