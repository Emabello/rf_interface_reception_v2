sap.ui.define(
  ["sap/ui/core/mvc/Controller", "sap/m/MessageBox"],
  function (Controller, MessageBox) {
    "use strict";

    return Controller.extend("rfinterfacereceptionv2.controller.SecondView", {
      _debounceTimer: null,

      onInit: function () {
        var oRouter = this.getOwnerComponent().getRouter();

        oRouter
          .getRoute("RouteSecondView")
          .attachPatternMatched(this._onRouteMatched, this);

        // Recupero la stringa con la chiave
        var sText = this.getOwnerComponent()
          .getModel("i18n")
          .getResourceBundle()
          .getText("NPLT");

        // Prendo il bottone per id locale e cambio il testo
        this.byId("_IDGenButton_3").setText(sText);

        // Recupero la stringa con la chiave
        var sText = this.getOwnerComponent()
          .getModel("i18n")
          .getResourceBundle()
          .getText("Save ");

        // Prendo il bottone per id locale e cambio il testo
        this.byId("_IDGenButton_4").setText(sText);

        // Recupero la stringa con la chiave
        var sText = this.getOwnerComponent()
          .getModel("i18n")
          .getResourceBundle()
          .getText("Cancel");

        // Prendo il bottone per id locale e cambio il testo
        this.byId("_IDGenButton_5").setText(sText);

        const sStoreOrder = sessionStorage.getItem("storeOrder");

        if (!sStoreOrder) {
          // Redirect
          const oRouter = sap.ui.core.UIComponent.getRouterFor(this);
          oRouter.navTo("RouteFirstView");
        }

        var oEmptyModel = new sap.ui.model.json.JSONModel({
          Article: "",
          QTY: "",
          UM: "",
          Lot: "",
          DDM: "",
        });
        this.getView().setModel(oEmptyModel, "model");
      },

      //onNavBack: function () {
      //  const oRouter = sap.ui.core.UIComponent.getRouterFor(this);
      //  oRouter.navTo("RouteFirstView");
      //},

      onScanSuccessOne: function (oEvent) {
        const oResourceBundle = this.getOwnerComponent()
          .getModel("i18n")
          .getResourceBundle();

        if (oEvent.getParameter("cancelled")) {
          const sText = oResourceBundle.getText("ScanCancelled");
          MessageToast.show(sText, { duration: 1000 });
          return;
        }

        const scannedValue = oEvent.getParameter("text");

        if (scannedValue !== undefined && scannedValue !== null) {
          const customData = oEvent.getSource().getCustomData();

          const inputId = customData
            .find((d) => d.getKey() === "inputId")
            ?.getValue();

          const oView = this.getView();

          if (inputId) {
            const input = oView.byId(inputId);
            if (input) {
              input.setValue(scannedValue);
            }
          }
        } else {
          const sText = oResourceBundle.getText("NoBarcodeDetected");
          MessageToast.show(sText, { duration: 1000 });

          const oInput = this.byId("sampleBarcodeScannerResultTwo");
          if (oInput) {
            oInput.setValue(""); // Pulisce il campo
          }
        }
      },

      onPress: async function () {
        const oView = this.getView();
        const oModel = oView.getModel();

        const s_barCode1 = oView.byId("_IDGenInput_3_t").getValue();

        // Controllo che almeno uno sia compilato
        if (!s_barCode1) {
          const sText = this.getOwnerComponent()
            .getModel("i18n")
            .getResourceBundle()
            .getText("PleaseEnterEAN");

          MessageBox.error(sText);
          return;
        }

        // Funzione per validare il barcode tramite chiamata OData
        const validateBarcode = (sBarcode) => {
          let that = this;
          return new Promise((resolve) => {
            const sOrder = sessionStorage.getItem("storeOrder");

            var oJSONModelHeader = new sap.ui.model.json.JSONModel({
              Article: "",
              QTY: "",
              UM: "",
              Lot: "",
              DDM: "",
              Plant: "",
            });

            oView.setModel(oJSONModelHeader, "model");

            oModel.callFunction("/getPOEAN", {
              method: "GET",
              urlParameters: {
                PurchaseOrder: sOrder,
                ean_128: sBarcode.toString(),
              },
              success: function (oData) {
                if (oData.getPOEAN.Message) {
                  MessageBox.error(oData.getPOEAN.Message);
                  resolve(false);
                } else if (!oData.getPOEAN.Qte) {
                  const sText = that
                    .getOwnerComponent()
                    .getModel("i18n")
                    .getResourceBundle()
                    .getText("ErrorDuring");
                  MessageBox.error(sText);
                  resolve(false);
                } else {
                  //Material
                  const paddedMaterial = oData.getPOEAN.Material.padStart(
                    18,
                    "0"
                  );

                  //Qty
                  const qteFormatted = parseInt(
                    oData.getPOEAN.Qte,
                    10
                  ).toLocaleString("en-US", {
                    minimumFractionDigits: 3,
                    maximumFractionDigits: 3,
                  });

                  //Date
                  const formattedDate =
                    oData.getPOEAN.Date.slice(6, 8) +
                    "." +
                    oData.getPOEAN.Date.slice(4, 6) +
                    "." +
                    oData.getPOEAN.Date.slice(0, 4);

                  var oJSONModelHeader = new sap.ui.model.json.JSONModel({
                    Article: paddedMaterial,
                    QTY: qteFormatted,
                    UM: oData.getPOEAN.Um,
                    Lot: oData.getPOEAN.Charg,
                    DDM: formattedDate,
                    Plant: oData.getPOEAN.Plant,
                  });

                  globalThis.readData = {};
                  globalThis.readData = {
                    PurchaseOrder: oData.getPOEAN.Purchaseorder,
                    PurchaseOrderItem: oData.getPOEAN.Purchaseorderitem,
                    Material: oData.getPOEAN.Material,
                    Plant: oData.getPOEAN.Plant,
                    StorageLocation: oData.getPOEAN.Storagelocation,
                    GoodsMovementType: "101",
                    Qte: oData.getPOEAN.Qte,
                    Batch: oData.getPOEAN.Charg,
                    EntryUnit: oData.getPOEAN.Um,
                  };
                  oView.setModel(oJSONModelHeader, "model");

                  resolve(true);
                }
              },
              error: function () {
                const sText = that
                  .getOwnerComponent()
                  .getModel("i18n")
                  .getResourceBundle()
                  .getText("ErrorDuring");
                MessageBox.error(sText);
                resolve(false);
              },
            });
          });
        };

        // Chiamo in parallelo la validazione per entrambi i barcode
        let okBarcode = null;

        if (s_barCode1) {
          okBarcode = await validateBarcode(s_barCode1);
        } else {
          MessageBox.error("Please fill in the EAN field first.");
          return;
        }

        if (okBarcode) {

          // Se è la prima volta, inizializza la struttura
          if (!globalThis.finalPayloadList) {
            globalThis.finalPayloadList = [];
          }

          globalThis.finalPayload = {};
          if (
            globalThis.finalPayload ||
            (globalThis.finalPayload.PostingDate == "" &&
              globalThis.finalPayload.GoodsMovementCode == "" &&
              globalThis.finalPayload.to_MaterialDocumentItem.length === 0)
          ) {
            var today = new Date();

            var parsedDate = new Date(
              today.getFullYear(), // anno
              today.getMonth(), // mese (0-based)
              today.getDate() // giorno
            );

            var yyyy = parsedDate.getFullYear();
            var mm = String(parsedDate.getMonth() + 1).padStart(2, "0");
            var dd = String(parsedDate.getDate()).padStart(2, "0");

            var localDateStr = yyyy + "-" + mm + "-" + dd;

            globalThis.finalPayload = {
              PostingDate: localDateStr + "T00:00:00",
              GoodsMovementCode: "01",
              to_MaterialDocumentItem: [],
            };
          }
        }
      },

      onLiveChange: function (oEvent) {
        const sValue = oEvent.getParameter("value");
        if (!sValue) {
          globalThis.readData = {};

          globalThis.finalPayloadList = [];

          this.getView().byId("_IDGenInput_4_t").setValue("");
          this.getView().byId("_IDGenInput_5_t").setValue("");
          this.getView().byId("_IDGenInput_6_t").setValue("");
          this.getView().byId("_IDGenInput_7_t").setValue("");

          clearTimeout(this._debounceTimer);
          return;
        }

        globalThis.finalPayload = {
          PostingDate: "",
          GoodsMovementCode: "",
          to_MaterialDocumentItem: [],
        };

        // Resetta il timer
        clearTimeout(this._debounceTimer);

        this.onPress(); // Simula invio dopo inattività
      },

      onPressAccept: function () {
        if (
          !globalThis.finalPayload ||
          (globalThis.finalPayload.PostingDate == "" &&
            globalThis.finalPayload.GoodsMovementCode == "" &&
            globalThis.finalPayload.to_MaterialDocumentItem.length === 0)
        ) {
          const sText = this.getOwnerComponent()
            .getModel("i18n")
            .getResourceBundle()
            .getText("PleaseEnterEANF");

          MessageBox.error(sText);
        } else {
          globalThis.finalPayload.to_MaterialDocumentItem.push({
            PurchaseOrder: globalThis.readData.PurchaseOrder,
            PurchaseOrderItem: globalThis.readData.PurchaseOrderItem,
            Material: globalThis.readData.Material,
            Plant: globalThis.readData.Plant,
            StorageLocation: globalThis.readData.StorageLocation,
            GoodsMovementType: globalThis.readData.GoodsMovementType,
            QuantityInEntryUnit: globalThis.readData.Qte,
            Batch: globalThis.readData.Batch,
            EntryUnit: globalThis.readData.EntryUnit,
            GoodsMovementRefDocType: "B",
          });

          globalThis.finalPayloadList.push({ ...globalThis.finalPayload });
          globalThis.readData = {};

          this.getView().byId("_IDGenInput_3_t").setValue("");

          this.getView().byId("_IDGenInput_4_t").setValue("");
          this.getView().byId("_IDGenInput_5_t").setValue("");
          this.getView().byId("_IDGenInput_6_t").setValue("");
          this.getView().byId("_IDGenInput_7_t").setValue("");
        }
      },

      onPressReject: function () {
        const oView = this.getView();

        globalThis.readData = {};

        globalThis.finalPayloadList = [];
        globalThis.finalPayload = {
          PostingDate: "",
          GoodsMovementCode: "",
          to_MaterialDocumentItem: [],
        };

        oView.byId("_IDGenInput_3_t").setValue("");

        oView.byId("_IDGenInput_4_t").setValue("");
        oView.byId("_IDGenInput_5_t").setValue("");
        oView.byId("_IDGenInput_6_t").setValue("");
        oView.byId("_IDGenInput_7_t").setValue("");

        const oRouter = sap.ui.core.UIComponent.getRouterFor(this);
        oRouter.navTo("RouteFirstView");
      },

      onSave: function () {
        if (
          !globalThis.finalPayload ||
          (globalThis.finalPayload.PostingDate == "" &&
            globalThis.finalPayload.GoodsMovementCode == "" &&
            globalThis.finalPayload.to_MaterialDocumentItem.length === 0)
        ) {
          const sText = this.getOwnerComponent()
            .getModel("i18n")
            .getResourceBundle()
            .getText("PleaseEnterEANF");

          MessageBox.error(sText);
        } else {
          globalThis.finalPayload.to_MaterialDocumentItem.push({
            PurchaseOrder: globalThis.readData.PurchaseOrder,
            PurchaseOrderItem: globalThis.readData.PurchaseOrderItem,
            Material: globalThis.readData.Material,
            Plant: globalThis.readData.Plant,
            StorageLocation: globalThis.readData.StorageLocation,
            GoodsMovementType: globalThis.readData.GoodsMovementType,
            QuantityInEntryUnit: globalThis.readData.Qte,
            Batch: globalThis.readData.Batch,
            EntryUnit: globalThis.readData.EntryUnit,
            GoodsMovementRefDocType: "B",
          });

          globalThis.finalPayloadList.push({ ...globalThis.finalPayload });

          sessionStorage.setItem(
            "finalPayloadList",
            JSON.stringify(globalThis.finalPayloadList)
          );
          this.getOwnerComponent().getRouter().navTo("RouteSaveView");
        }
      },

      onNavBack: function () {
        var sOrigin = window.location.origin;
        var sUrl = sOrigin + "/ui?sap-ushell-config=headerless#RFMenu-display";
        window.location.href = sUrl;
      },

      _onRouteMatched: function () {
        const oView = this.getView();

        globalThis.readData = {};

        oView.byId("_IDGenInput_3_t").setValue("");

        oView.byId("_IDGenInput_4_t").setValue("");
        oView.byId("_IDGenInput_5_t").setValue("");
        oView.byId("_IDGenInput_6_t").setValue("");
        oView.byId("_IDGenInput_7_t").setValue("");

        oView.byId("_IDGenInput_8_t").setValue(sessionStorage.storeOrder);
      },
    });
  }
);
