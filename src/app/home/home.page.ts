import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { ToastController } from '@ionic/angular';
import { Share } from '@capacitor/share';
import { Network } from '@capacitor/network';
import { parseISO, format } from 'date-fns';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage implements OnInit {
  currentDate: string = '';

  // variable para cambiar icono de conexion
  icon: string = '';
  isConnected: boolean = false;

  // arreglo de eventos
  eventos = Array<{ id: number, titulo: string, descripcion: string, fecha: string, hora: string, lugar: string, imagen: string }>();

  // variables datos del evento
  newTitulo = '';
  newDescripcion = '';
  newFecha: any | null;
  newHora: any | null;
  newLugar = '';
  newImagen = '';
  updateId: number | null = null;

  // variable para almacenar la fecha, color del texto y color de fondo
  highlightedDates = Array<{ date: String, textColor: String, backgroundColor: String }>();

  // variables para saber la fecha y saber la fecha seleccionada por el usuario
  selectedDate: String = '';
  selectedDay: String = '';

  // variables para lista de los eventos de ese dia y filtrarlos y el resultado de la busqueda
  eventosSelecionados: any[] = [];
  results: any[] = [];

  // variable para abrir modal de agregar evento
  isModalAddEventOpen = false;
  // variable para abrir el modal de los eventos de esa fecha
  isModalEventosOpen = false;
  // variable para abrir el modal de lmodificar evento
  isModalUpdateEvento = false;

  constructor(private cdr: ChangeDetectorRef, private toastController: ToastController) {
    this.setCurrentDate();
  }

  ngOnInit() {
    this.checkNetworkStatus();
  }

  setCurrentDate() {
    const today = new Date();
    this.currentDate = today.toISOString().split('T')[0]; // Formato YYYY-MM-DD
  }

  // metodo para verificar la conexion
  async checkNetworkStatus() {
    const status = await Network.getStatus();

    this.isConnected = status.connected;
    this.icon = status.connected ? "cloud-done-outline" : "cloud-offline-outline";
    this.cdr.detectChanges(); // Detectar cambios

    Network.addListener('networkStatusChange', (status) => {
      this.isConnected = status.connected;
      this.icon = status.connected ? "cloud-done-outline" : "cloud-offline-outline";
      this.cdr.detectChanges(); // Detectar cambios
    });
  }

  // metodo para compartir
  async compartir(evento: any) {
    await Share.share({
      title: evento.titulo,
      text: `Descripción: ${evento.descripcion}\nFecha: ${evento.fecha}\nHora: ${evento.hora}\nLugar: ${evento.lugar}`,
      dialogTitle: 'Compartir evento'
    });
  }

  // metodo para cargar al momento el highlightedDates al momento de agregar un evento
  loadHighlightedDates() {
    this.highlightedDates = [];
    this.eventos.forEach(evento => {
      this.addHighlightedDate(evento.fecha, '#ffffff', this.getRandomColor());
    });
  }

  // metodo para tomar una foto
  async tomarFoto() {
    const image = await Camera.getPhoto({
      quality: 100,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Camera,
    });

    this.newImagen = image.dataUrl ?? ''; // Proporciona un valor predeterminado si image.dataUrl es undefined
  }

  // colores para background del boton del dia
  getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
      color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
  }

  // limpiar datos del evento
  clearData() {
    this.newTitulo = '';
    this.newDescripcion = '';
    this.newFecha = null;
    this.newHora = null;
    this.newLugar = '';
    this.newImagen = '';
    this.updateId = null;
  }

  // metodo para agregar el highlightedDates al agregar nuevo evento
  addHighlightedDate(date: String, textColor: String, backgroundColor: String) {
    const dateExists = this.highlightedDates.some(highlightedDate => highlightedDate.date === date);
    if (!dateExists) {
      this.highlightedDates.push({ date, textColor, backgroundColor });
      console.log('highlightedDates', this.highlightedDates);
    }
  }

  // metodo para agregar evento
  async addEvento() {
    if (!this.isConnected) {
      console.log('No hay conexión a internet. No se puede agregar el evento.');
      return;
    }

    const fechaObj = new Date(this.newFecha);
    const horaObj = new Date(this.newHora);

    const fecha = fechaObj instanceof Date && !isNaN(fechaObj.getTime()) ?
      fechaObj.toISOString().split('T')[0] : '';
    const hora = horaObj instanceof Date && !isNaN(horaObj.getTime()) ?
      horaObj.toISOString().split('T')[1].split('.')[0] : '';

    if (this.updateId !== null) {
      // actualizar evento
      this.updateEvento(this.updateId, this.newTitulo, this.newDescripcion, fecha, hora, this.newLugar, this.newImagen);
    } else if (this.newTitulo && this.newDescripcion && fecha && hora && this.newLugar && this.newImagen) {
      this.eventos.push({
        id: this.eventos.length + 1,
        titulo: this.newTitulo,
        descripcion: this.newDescripcion,
        fecha: fecha,
        hora: hora,
        lugar: this.newLugar,
        imagen: this.newImagen
      });

      this.addHighlightedDate(fecha, '#ffffff', this.getRandomColor());

      console.log('evento agregado');
      this.refreshEvents();
      console.log(this.eventos);

      if (this.selectedDate === fecha) {
        this.syncSelectedDateEvents();
      }
    } else {
      const toast = await this.toastController.create({
        message: 'Por favor, complete todos los campos.',
        duration: 2000,
        color: 'danger',
        position: 'top'
      })
      toast.present();
    }

    this.clearData();
    this.loadHighlightedDates();

    console.log('eventos', JSON.stringify(this.eventos));

    this.setOpenModalAddEvent(false);
    this.setOpenModalUpdateEvent(false);
  }

  // metodo para actualizar evento
  updateEvento(id: number, titulo: string, descripcion: string, fecha: string, hora: string, lugar: string, imagen: string) {
    if (!this.isConnected) {
      console.log('No hay conexión a internet. No se puede actualizar el evento.');
      return;
    }

    const eventoIndex = this.eventos.findIndex(evento => evento.id === id);
    if (eventoIndex !== -1) {
      // Convertir la cadena de fecha a un objeto Date usando date-fns
      const fechaObj = parseISO(fecha);
      const fechaStr = format(fechaObj, 'yyyy-MM-dd'); // Convertir a formato YYYY-MM-DD

      this.eventos[eventoIndex] = { id, titulo, descripcion, fecha: fechaStr, hora, lugar, imagen };
      console.log('evento actualizado');
      console.log(JSON.stringify(this.eventos[eventoIndex]));
      this.refreshEvents(); // Actualizar la lista de eventos seleccionados y los resultados de la búsqueda
      if (this.selectedDate === fechaStr) {
        this.syncSelectedDateEvents();
      }
      this.updateResults(); // Refrescar la vista
      this.loadHighlightedDates(); // Refrescar las fechas destacadas en el calendario
    } else {
      console.error(`Evento con id ${id} no encontrado.`);
    }
  }

  updateResults() {
    this.results = this.eventos.filter(evento => evento.fecha === this.selectedDate);
  }

  openUpdateModal(evento: any) {
    this.newTitulo = evento.titulo;
    this.newDescripcion = evento.descripcion;
    this.newFecha = evento.fecha;
    this.newHora = evento.hora.includes('T') ? evento.hora : `1970-01-01T${evento.hora}`;
    this.newLugar = evento.lugar;
    this.newImagen = evento.imagen;
    this.updateId = evento.id;
    this.setOpenModalUpdateEvent(true);
  }

  // metodo para eliminar evento
  deleteEvento(id: number) {
    if (!this.isConnected) {
      console.log('No hay conexión a internet. No se puede eliminar el evento.');
      return;
    }

    const eventoIndex = this.eventos.findIndex(evento => evento.id === id);
    if (eventoIndex !== -1) {
      const fecha = this.eventos[eventoIndex].fecha;
      this.eventos.splice(eventoIndex, 1);
      console.log('evento eliminado');
      this.refreshEvents(); // Actualizar la lista de eventos seleccionados y los resultados de la búsqueda

      // Verificar si ya no hay eventos en la fecha y eliminarla de highlightedDates
      const eventosEnFecha = this.eventos.filter(evento => evento.fecha === fecha);
      if (eventosEnFecha.length === 0) {
        this.highlightedDates = this.highlightedDates.filter(highlightedDate => highlightedDate.date !== fecha);
        console.log('highlightedDates actualizado', this.highlightedDates);
      }
    } else {
      console.error(`Evento con id ${id} no encontrado.`);
    }
  }

  // metodo para refrescar eventos
  refreshEvents() {
    this.eventosSelecionados = this.eventos.filter(evento => evento.fecha === this.selectedDate);
    this.results = [...this.eventosSelecionados];
  }

  // mostrar eventos por fecha seleccionada
  onDateClick(event: any) {
    const selectedDate = event.detail.value.split('T')[0];
    this.selectedDate = selectedDate;
    this.selectedDay = new Date(selectedDate).toLocaleDateString('es-ES', { weekday: 'long' });
    this.syncSelectedDateEvents();
    console.log('modal eventos abierto');
    this.setOpenModalEventos(true);
  }

  // abrir o cerrar el modal de eventos de esa fecha
  setOpenModalEventos(isOpen: boolean) {
    this.isModalEventosOpen = isOpen;
    if (isOpen) {
      this.refreshEvents(); // Cargar eventos al abrir el modal
    }
  }

  // abrir o cerrar el modal de agregar evento
  setOpenModalAddEvent(isOpen: boolean) {
    this.isModalAddEventOpen = isOpen;
    if (!isOpen) {
      this.clearData();
    }
  }

  // abrir o cerrar modal de modificar
  setOpenModalUpdateEvent(isOpen: boolean) {
    this.isModalUpdateEvento = isOpen;
    if (!isOpen) {
      this.clearData();
    }
  }

  // filtrar eventos
  handleInput(event: any) {
    const value = event.target.value;
    this.results = this.eventosSelecionados.filter(event => event.titulo.toLowerCase().includes(value.toLowerCase()));
  }

  syncSelectedDateEvents() {
    this.eventosSelecionados = this.eventos.filter(evento => evento.fecha === this.selectedDate);
    this.results = this.eventosSelecionados;
  }

  // metodo para obtener eventos proximos organizados por fecha
  getUpcomingEvents() {
    if (!this.isConnected) {
      return [];
    }
    const today = new Date().toISOString().split('T')[0];
    return this.eventos
      .filter(evento => new Date(evento.fecha).toISOString().split('T')[0] >= today)
      .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
  }
}
