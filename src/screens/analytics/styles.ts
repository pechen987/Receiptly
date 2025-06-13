import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  widgetBg: {
    backgroundColor: '#202338',
    borderRadius: 18,
    paddingTop: 16,
    paddingHorizontal: 0,
    paddingBottom: 8,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
  },
  widgetContainer: {
    marginBottom: 16,
  },
  dragHandle: {
    position: 'absolute',
    top: -6,
    alignSelf: 'center',
    zIndex: 1,
    paddingVertical: 4,
    paddingHorizontal: 16,
    backgroundColor: '#202338',
    borderRadius: 16,
  },
  widgetContent: {
    padding: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 16,
  },
  titleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: { 
    color: '#e6e9f0', 
    fontSize: 20, 
    fontWeight: '700', 
    marginRight: 10 
  },
  selector: { 
    flexDirection: 'row', 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginBottom: 0 
  },
  btn: { 
    paddingVertical: 6, 
    paddingHorizontal: 12, 
    borderRadius: 12, 
    backgroundColor: '#232632', 
    marginHorizontal: 4 
  },
  btnActive: { 
    backgroundColor: '#7e5cff' 
  },
  btnText: { 
    color: '#8ca0c6', 
    fontWeight: '600' 
  },
  btnTextActive: { 
    color: '#fff' 
  },
  message: { 
    color: '#8ca0c6', 
    textAlign: 'center', 
    marginTop: 32, 
    fontSize: 16 
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#232632',
    borderRadius: 18,
    width: '90%',
    marginVertical: 40,
    padding: 18,
    flex: 0.4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.17,
    shadowRadius: 12,
    elevation: 4,
  },
  modalTitle: {
    color: '#e6e9f0',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalLoading: {
    color: '#8ca0c6',
    textAlign: 'center',
    marginVertical: 24,
  },
  modalEmpty: {
    color: '#8ca0c6',
    textAlign: 'center',
    marginVertical: 24,
  },
  closeModalBtn: {
    marginTop: 16,
    alignSelf: 'center',
    backgroundColor: '#7e5cff',
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 7,
  },
  closeModalText: { 
    color: '#fff', 
    fontWeight: '600', 
    fontSize: 15 
  },
}); 